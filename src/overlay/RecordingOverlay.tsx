import { listen } from "@tauri-apps/api/event";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  VoiceAssistantIcon,
  TranscriptionIcon,
  CancelIcon,
} from "../components/icons";
import "./RecordingOverlay.css";
import { commands } from "@/bindings";
import i18n, { syncLanguageFromSettings } from "@/i18n";
import { getLanguageDirection } from "@/lib/utils/rtl";

type OverlayState = "loading" | "recording" | "transcribing" | "processing";

const WAVE_W = 120;
const WAVE_H = 36;
const WAVE_PTS = 80;

const RecordingOverlay: React.FC = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [state, setState] = useState<OverlayState>("recording");
  const [levels, setLevels] = useState<number[]>(Array(16).fill(0));
  const smoothedLevelsRef = useRef<number[]>(Array(16).fill(0));
  const phaseRef = useRef(0);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  const direction = getLanguageDirection(i18n.language);

  // 整体音量
  const energy = (() => {
    const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
    const peak = Math.max(...levels);
    const raw = avg * 0.3 + peak * 0.7;
    return Math.min(Math.pow(raw, 0.35) * 2.5, 1);
  })();

  // 录音波形相位: 静默时几乎不动, 说话时缓缓流动
  useEffect(() => {
    phaseRef.current += 0.005 + energy * 0.04;
  }, [levels]);

  // 加载状态动画: 独立的相位驱动呼吸波形
  useEffect(() => {
    if (state !== "loading") return;
    let raf: number;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setLoadingPhase((p) => p + dt * 1.2);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  // 转录/处理状态: 窗口大小由 Rust 端直接设置 (NSPanel 下前端 setSize 无效)
  // CSS width: fit-content 让内容自适应
  useEffect(() => {
    if (state !== "transcribing" && state !== "processing") return;
  }, [state]);

  useEffect(() => {
    const setupEventListeners = async () => {
      const unlistenShow = await listen("show-overlay", async (event) => {
        await syncLanguageFromSettings();
        const overlayState = event.payload as OverlayState;
        setState(overlayState);
        setIsVisible(true);

        // 窗口大小由 Rust 端直接设置 (NSPanel 下前端 setSize 无效)
        if (overlayState === "recording" || overlayState === "loading") {
          // Rust 端已设置好宽度
        }
      });

      const unlistenHide = await listen("hide-overlay", () => {
        setIsVisible(false);
      });

      const unlistenLevel = await listen<number[]>("mic-level", (event) => {
        const newLevels = event.payload as number[];
        const smoothed = smoothedLevelsRef.current.map((prev, i) => {
          const target = newLevels[i] || 0;
          return prev * 0.3 + target * 0.7;
        });
        smoothedLevelsRef.current = smoothed;
        setLevels(smoothed.slice(0, 16));

        // 收到音频数据, 自动从 loading 切换到 recording 波形显示
        setState((prev) => (prev === "loading" ? "recording" : prev));
      });

      return () => {
        unlistenShow();
        unlistenHide();
        unlistenLevel();
      };
    };

    setupEventListeners();
  }, []);

  const getIcon = () => {
    if (state === "loading" || state === "recording") {
      return <VoiceAssistantIcon width={24} height={24} />;
    } else {
      return <TranscriptionIcon width={24} height={24} />;
    }
  };

  // 加载中呼吸波形: 固定低振幅 + 亮度脉动
  const renderLoadingWave = () => {
    const mid = WAVE_H / 2;
    const breathAmp = 3 + Math.sin(loadingPhase * Math.PI) * 2;

    const path = Array.from({ length: WAVE_PTS }, (_, i) => {
      const t = i / (WAVE_PTS - 1);
      const x = t * WAVE_W;
      const y = mid + Math.sin(t * Math.PI * 2 + loadingPhase * 2) * breathAmp;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join("");

    const breathOpacity = 0.3 + Math.sin(loadingPhase * Math.PI) * 0.2;

    return (
      <svg
        className="wave-svg"
        viewBox={`0 0 ${WAVE_W} ${WAVE_H}`}
        preserveAspectRatio="none"
      >
        <path
          d={path}
          stroke="#94a3b8"
          strokeWidth="1.5"
          strokeDasharray="6 4"
          fill="none"
          style={{
            filter: `drop-shadow(0 0 3px rgba(148,163,184,${breathOpacity}))`,
          }}
        />
      </svg>
    );
  };

  // 录音波形: 跟随音频能量
  const renderWave = () => {
    const amplitude = 1 + energy * 12;
    const mid = WAVE_H / 2;

    const path = Array.from({ length: WAVE_PTS }, (_, i) => {
      const t = i / (WAVE_PTS - 1);
      const x = t * WAVE_W;
      const y =
        mid + Math.sin(t * Math.PI * 2 + phaseRef.current) * amplitude;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join("");

    return (
      <svg
        className="wave-svg"
        viewBox={`0 0 ${WAVE_W} ${WAVE_H}`}
        preserveAspectRatio="none"
      >
        <path
          d={path}
          stroke="#ffb8d4"
          strokeWidth="1.5"
          fill="none"
          style={{
            filter: `drop-shadow(0 0 ${2 + energy * 4}px rgba(255,184,212,${0.3 + energy * 0.5}))`,
          }}
        />
      </svg>
    );
  };

  return (
    <div
      ref={overlayRef}
      dir={direction}
      className={`recording-overlay ${isVisible ? "fade-in" : ""} ${state === "transcribing" || state === "processing" ? "overlay-compact" : ""}`}
    >
      {state === "loading" && (
        <>
          <div className={`overlay-left icon-breathing`}>
            {getIcon()}
          </div>
          <div className="overlay-middle">{renderLoadingWave()}</div>
          <div className="overlay-right">
            <div
              className="cancel-button"
              onClick={() => {
                commands.cancelOperation();
              }}
            >
              <CancelIcon width={20} height={20} />
            </div>
          </div>
        </>
      )}
      {state === "recording" && (
        <>
          <div className="overlay-left">{getIcon()}</div>
          <div className="overlay-middle">{renderWave()}</div>
          <div className="overlay-right">
            <div
              className="cancel-button"
              onClick={() => {
                commands.cancelOperation();
              }}
            >
              <CancelIcon width={20} height={20} />
            </div>
          </div>
        </>
      )}
      {(state === "transcribing" || state === "processing") && (
        <div className="overlay-center">
          {getIcon()}
          <span className="transcribing-text">
            {state === "transcribing"
              ? t("overlay.transcribing")
              : t("overlay.processing")}
          </span>
        </div>
      )}
    </div>
  );
};

export default RecordingOverlay;
