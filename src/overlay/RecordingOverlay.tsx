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

const RecordingOverlay: React.FC = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [state, setState] = useState<OverlayState>("recording");
  const [levels, setLevels] = useState<number[]>(Array(16).fill(0));
  const smoothedLevelsRef = useRef<number[]>(Array(16).fill(0));
  const phaseRef = useRef(0);
  const direction = getLanguageDirection(i18n.language);

  // 整体音量
  const energy = (() => {
    const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
    const peak = Math.max(...levels);
    const raw = avg * 0.3 + peak * 0.7;
    return Math.min(Math.pow(raw, 0.35) * 2.5, 1);
  })();

  // 波纹相位: 静默时几乎不动, 说话时缓缓流动
  useEffect(() => {
    phaseRef.current += 0.005 + energy * 0.04;
  }, [levels]);

  useEffect(() => {
    const setupEventListeners = async () => {
      const unlistenShow = await listen("show-overlay", async (event) => {
        await syncLanguageFromSettings();
        const overlayState = event.payload as OverlayState;
        setState(overlayState);
        setIsVisible(true);
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
    if (state === "recording") {
      return <VoiceAssistantIcon width={24} height={24} />;
    } else {
      return <TranscriptionIcon width={24} height={24} />;
    }
  };

  const renderWave = () => {
    const amplitude = 1 + energy * 14;
    const w = 120;
    const h = 36;
    const mid = h / 2;
    const pts = 80;

    const path = Array.from({ length: pts }, (_, i) => {
      const t = i / (pts - 1);
      const x = t * w;
      const y =
        mid + Math.sin(t * Math.PI * 2 + phaseRef.current) * amplitude;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join("");

    return (
      <svg
        className="wave-svg"
        viewBox={`0 0 ${w} ${h}`}
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
      dir={direction}
      className={`recording-overlay ${isVisible ? "fade-in" : ""}`}
    >
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
