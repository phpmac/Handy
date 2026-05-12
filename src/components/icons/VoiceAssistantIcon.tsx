import React from "react";

interface VoiceAssistantIconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

const VoiceAssistantIcon: React.FC<VoiceAssistantIconProps> = ({
  width = 24,
  height = 24,
  color = "#FAA2CA",
  className = "",
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Robot head outline */}
      <rect
        x="5"
        y="6"
        width="14"
        height="12"
        rx="3"
        stroke={color}
        strokeWidth="1.8"
        fill="none"
      />
      {/* Antenna */}
      <line
        x1="12"
        y1="6"
        x2="12"
        y2="3"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="2.5" r="1.2" fill={color} />
      {/* Left eye */}
      <circle cx="9" cy="11" r="1.5" fill={color} />
      {/* Right eye */}
      <circle cx="15" cy="11" r="1.5" fill={color} />
      {/* Mouth / voice wave */}
      <path
        d="M9 15.5C9.5 16.5 10.5 17 12 17C13.5 17 14.5 16.5 15 15.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Left sound wave */}
      <path
        d="M3 10C2 11.5 2 13.5 3 15"
        stroke={color}
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M1 8.5C-0.3 11 -0.3 14 1 16.5"
        stroke={color}
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      {/* Right sound wave */}
      <path
        d="M21 10C22 11.5 22 13.5 21 15"
        stroke={color}
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M23 8.5C24.3 11 24.3 14 23 16.5"
        stroke={color}
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
    </svg>
  );
};

export default VoiceAssistantIcon;
