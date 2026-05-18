use crate::actions::ACTION_MAP;
use crate::managers::audio::AudioRecordingManager;
use crate::tray::{self, TrayIconState};
use crate::utils;
use log::{debug, error, warn};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

const DEBOUNCE: Duration = Duration::from_millis(30);
const PROCESSING_TIMEOUT: Duration = Duration::from_secs(60);
/// 超时检测轮询间隔
const POLL_INTERVAL: Duration = Duration::from_secs(5);

/// Commands processed sequentially by the coordinator thread.
enum Command {
    Input {
        binding_id: String,
        hotkey_string: String,
        is_pressed: bool,
        push_to_talk: bool,
    },
    Cancel {
        recording_was_active: bool,
    },
    ProcessingFinished {
        session_id: u64,
    },
}

/// Pipeline lifecycle, owned exclusively by the coordinator thread.
#[derive(Debug)]
enum Stage {
    Idle,
    Recording(String), // binding_id
    Processing,
}

/// Serialises all transcription lifecycle events through a single thread
/// to eliminate race conditions between keyboard shortcuts, signals, and
/// the async transcribe-paste pipeline.
pub struct TranscriptionCoordinator {
    tx: Sender<Command>,
    /// 递增的会话计数器, 用于判断异步转录任务是否属于当前会话
    session: AtomicU64,
}

pub fn is_transcribe_binding(id: &str) -> bool {
    id == "transcribe" || id == "transcribe_with_post_process"
}

impl TranscriptionCoordinator {
    pub fn new(app: AppHandle) -> Self {
        let (tx, rx) = mpsc::channel();

        thread::spawn(move || {
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                let mut stage = Stage::Idle;
                let mut last_press: Option<Instant> = None;
                // 当前期望的 session_id, 仅在 stage == Processing 时有意义
                let mut expected_session: u64 = 0;
                let mut processing_since: Option<Instant> = None;

                loop {
                    // 超时检测: Processing 持续过久则自动恢复
                    if matches!(stage, Stage::Processing) {
                        if let Some(since) = processing_since {
                            if since.elapsed() > PROCESSING_TIMEOUT {
                                warn!("Processing 超时 ({:?}), 自动恢复 Idle", since.elapsed());
                                if let Some(c) = app.try_state::<TranscriptionCoordinator>() {
                                    c.advance_session();
                                }
                                stage = Stage::Idle;
                                processing_since = None;
                                utils::hide_recording_overlay(&app);
                                tray::change_tray_icon(&app, TrayIconState::Idle);
                            }
                        }
                    }

                    match rx.recv_timeout(POLL_INTERVAL) {
                        Ok(cmd) => match cmd {
                            Command::Input {
                                binding_id,
                                hotkey_string,
                                is_pressed,
                                push_to_talk,
                            } => {
                                // 防抖: 30ms 内的重复 press 被忽略
                                if is_pressed {
                                    let now = Instant::now();
                                    if last_press
                                        .map_or(false, |t| now.duration_since(t) < DEBOUNCE)
                                    {
                                        debug!("Debounced press for '{binding_id}'");
                                        continue;
                                    }
                                    last_press = Some(now);
                                }

                                if push_to_talk {
                                    if is_pressed && matches!(stage, Stage::Idle) {
                                        start(&app, &mut stage, &binding_id, &hotkey_string);
                                    } else if !is_pressed
                                        && matches!(&stage, Stage::Recording(id) if id == &binding_id)
                                    {
                                        stop(
                                            &app,
                                            &mut stage,
                                            &binding_id,
                                            &hotkey_string,
                                            &mut expected_session,
                                            &mut processing_since,
                                        );
                                    }
                                } else if is_pressed {
                                    match &stage {
                                        Stage::Idle => {
                                            start(&app, &mut stage, &binding_id, &hotkey_string);
                                        }
                                        Stage::Recording(id) if id == &binding_id => {
                                            stop(
                                                &app,
                                                &mut stage,
                                                &binding_id,
                                                &hotkey_string,
                                                &mut expected_session,
                                                &mut processing_since,
                                            );
                                        }
                                        _ => {
                                            debug!("Ignoring press for '{binding_id}': pipeline busy (stage={stage:?}, session={expected_session})")
                                        }
                                    }
                                }
                            }
                            Command::Cancel {
                                recording_was_active,
                            } => match &stage {
                                Stage::Processing => {
                                    debug!(
                                        "Cancel: 中断 Processing 状态 (session={expected_session})"
                                    );
                                    if let Some(c) = app.try_state::<TranscriptionCoordinator>() {
                                        c.advance_session();
                                    }
                                    stage = Stage::Idle;
                                    processing_since = None;
                                }
                                _ if recording_was_active
                                    || matches!(stage, Stage::Recording(_)) =>
                                {
                                    stage = Stage::Idle;
                                    processing_since = None;
                                }
                                _ => {}
                            },
                            Command::ProcessingFinished { session_id } => {
                                if matches!(stage, Stage::Processing)
                                    && session_id == expected_session
                                {
                                    stage = Stage::Idle;
                                    processing_since = None;
                                } else {
                                    debug!(
                                        "Ignoring stale ProcessingFinished (sid={session_id}, expected={expected_session}, stage={stage:?})"
                                    );
                                }
                            }
                        },
                        Err(mpsc::RecvTimeoutError::Timeout) => {
                            // 轮询间隔到期, 回到循环顶部检查超时
                        }
                        Err(mpsc::RecvTimeoutError::Disconnected) => {
                            break;
                        }
                    }
                }
                debug!("Transcription coordinator exited");
            }));
            if let Err(e) = result {
                error!("Transcription coordinator panicked: {e:?}");
            }
        });

        Self {
            tx,
            session: AtomicU64::new(0),
        }
    }

    /// Send a keyboard/signal input event for a transcribe binding.
    /// For signal-based toggles, use `is_pressed: true` and `push_to_talk: false`.
    pub fn send_input(
        &self,
        binding_id: &str,
        hotkey_string: &str,
        is_pressed: bool,
        push_to_talk: bool,
    ) {
        if self
            .tx
            .send(Command::Input {
                binding_id: binding_id.to_string(),
                hotkey_string: hotkey_string.to_string(),
                is_pressed,
                push_to_talk,
            })
            .is_err()
        {
            warn!("Transcription coordinator channel closed");
        }
    }

    pub fn notify_cancel(&self, recording_was_active: bool) {
        if self
            .tx
            .send(Command::Cancel {
                recording_was_active,
            })
            .is_err()
        {
            warn!("Transcription coordinator channel closed");
        }
    }

    /// 返回当前会话 ID, 异步任务用于校验自身是否过期
    pub fn current_session(&self) -> u64 {
        self.session.load(Ordering::SeqCst)
    }

    /// 递增会话 ID 并返回新值
    fn advance_session(&self) -> u64 {
        self.session.fetch_add(1, Ordering::SeqCst).wrapping_add(1)
    }

    pub fn notify_processing_finished(&self, session_id: u64) {
        if self
            .tx
            .send(Command::ProcessingFinished { session_id })
            .is_err()
        {
            warn!("Transcription coordinator channel closed");
        }
    }
}

fn start(app: &AppHandle, stage: &mut Stage, binding_id: &str, hotkey_string: &str) {
    let Some(action) = ACTION_MAP.get(binding_id) else {
        warn!("No action in ACTION_MAP for '{binding_id}'");
        return;
    };
    action.start(app, binding_id, hotkey_string);
    if app
        .try_state::<Arc<AudioRecordingManager>>()
        .map_or(false, |a| a.is_recording())
    {
        *stage = Stage::Recording(binding_id.to_string());
    } else {
        debug!("Start for '{binding_id}' did not begin recording; staying idle");
    }
}

fn stop(
    app: &AppHandle,
    stage: &mut Stage,
    binding_id: &str,
    hotkey_string: &str,
    expected_session: &mut u64,
    processing_since: &mut Option<Instant>,
) {
    let Some(action) = ACTION_MAP.get(binding_id) else {
        warn!("No action in ACTION_MAP for '{binding_id}'");
        return;
    };
    *stage = Stage::Processing;
    *processing_since = Some(Instant::now());

    // 递增会话, 使旧任务的 FinishGuard 失效
    if let Some(c) = app.try_state::<TranscriptionCoordinator>() {
        *expected_session = c.advance_session();
    }

    action.stop(app, binding_id, hotkey_string);
}
