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

type OverlayState = "recording" | "transcribing" | "processing";

// 30 根细柱偏移, 中间高两边低, -1 表示固定装饰柱
const BAR_OFFSETS = [
  -1, 0.15, 0.22, 0.3, 0.4, 0.5, 0.6, 0.72, 0.84, 0.94, 1.0, 1.0, 0.94,
  0.84, 0.72, 0.72, 0.84, 0.94, 1.0, 1.0, 0.94, 0.84, 0.72, 0.6, 0.5,
  0.4, 0.3, 0.22, 0.15, -1,
];

const RecordingOverlay: React.FC = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [state, setState] = useState<OverlayState>("recording");
  const [levels, setLevels] = useState<number[]>(Array(16).fill(0));
  const smoothedLevelsRef = useRef<number[]>(Array(16).fill(0));
  const direction = getLanguageDirection(i18n.language);

  // 整体音量, 强增益确保说话时动画明显
  const energy = (() => {
    const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
    const peak = Math.max(...levels);
    const raw = avg * 0.3 + peak * 0.7;
    return Math.min(Math.pow(raw, 0.35) * 2.5, 1);
  })();

  useEffect(() => {
    const setupEventListeners = async () => {
      // Listen for show-overlay event from Rust
      const unlistenShow = await listen("show-overlay", async (event) => {
        // Sync language from settings each time overlay is shown
        await syncLanguageFromSettings();
        const overlayState = event.payload as OverlayState;
        setState(overlayState);
        setIsVisible(true);
      });

      // Listen for hide-overlay event from Rust
      const unlistenHide = await listen("hide-overlay", () => {
        setIsVisible(false);
      });

      // Listen for mic-level updates
      const unlistenLevel = await listen<number[]>("mic-level", (event) => {
        const newLevels = event.payload as number[];

        // 轻量平滑, 保留足够的响应性
        const smoothed = smoothedLevelsRef.current.map((prev, i) => {
          const target = newLevels[i] || 0;
          return prev * 0.3 + target * 0.7;
        });

        smoothedLevelsRef.current = smoothed;
        setLevels(smoothed.slice(0, 16));
      });

      // Cleanup function
      return () => {
        unlistenShow();
        unlistenHide();
        unlistenLevel();
      };
    };

    setupEventListeners();
  }, []);

  const getIcon = () => {
    if (state === "recording") {
      return <VoiceAssistantIcon width={24} height={24} />;
    } else {
      return <TranscriptionIcon width={24} height={24} />;
    }
  };

  return (
    <div
      dir={direction}
      className={`recording-overlay ${isVisible ? "fade-in" : ""}`}
    >
      {state === "recording" && (
        <>
          <div className="overlay-left">{getIcon()}</div>
          <div className="overlay-middle">
            <div className="bars-container">
              {BAR_OFFSETS.map((offset, i) => {
                const isFixed = offset === -1;
                const h = isFixed ? 4 : 3 + energy * offset * 34;
                return (
                  <div
                    key={i}
                    className={`bar ${isFixed ? "bar-static" : ""}`}
                    style={{
                      height: `${Math.min(36, h)}px`,
                    }}
                  />
                );
              })}
            </div>
          </div>
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
