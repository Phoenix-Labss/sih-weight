import React from 'react';

interface NikksMascotIconProps {
  className?: string;
  size?: number;
  glow?: boolean;
}

/**
 * Nikks AI — 3D Miniature Mascot Figure Icon
 * Inspired by Codex and Claude miniature 3D figures, with Legal Metrology branding.
 */
export const NikksMascotIcon: React.FC<NikksMascotIconProps> = ({
  className = '',
  size = 32,
  glow = true,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-label="Nikks AI Miniature Mascot"
    >
      <defs>
        {/* Ambient & Specular Gradients */}
        <radialGradient
          id="nikksGlow"
          cx="50%"
          cy="40%"
          r="60%"
          fx="40%"
          fy="30%"
        >
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
          <stop offset="60%" stopColor="#4f46e5" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#312e81" stopOpacity="0" />
        </radialGradient>

        {/* Head Gradient (Soft 3D Porcelain & Metallic Finish) */}
        <linearGradient id="nikksHeadGrad" x1="20" y1="15" x2="80" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#e0e7ff" />
          <stop offset="70%" stopColor="#a5b4fc" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>

        {/* Visor Screen (Deep Obsidian with Cyan/Amber Sheen) */}
        <linearGradient id="nikksVisorGrad" x1="28" y1="28" x2="72" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="50%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>

        {/* Glowing Eyes Gradient */}
        <linearGradient id="nikksEyeGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>

        {/* Amber Crown / Energy Orb */}
        <linearGradient id="nikksOrbGrad" x1="45" y1="2" x2="55" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="40%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>

        {/* Torso & Armor Gradient */}
        <linearGradient id="nikksTorsoGrad" x1="25" y1="58" x2="75" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="35%" stopColor="#c7d2fe" />
          <stop offset="85%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#3730a3" />
        </linearGradient>

        {/* Golden Metrology Chest Emblem */}
        <linearGradient id="nikksGoldCrest" x1="42" y1="68" x2="58" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>

        {/* Cute Ear Muff / Audio Sensors */}
        <linearGradient id="nikksEarGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>

        {/* Drop Shadows */}
        <filter id="nikksDropShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* 0. Ambient Glow Halo */}
      {glow && (
        <circle cx="50" cy="50" r="46" fill="url(#nikksGlow)" />
      )}

      {/* 1. Miniature Antenna & Energy Pulse Orb */}
      <g filter="url(#nikksDropShadow)">
        {/* Antenna Stem */}
        <path
          d="M50 16 V8"
          stroke="#818cf8"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Golden Energy Beacon Orb */}
        <circle cx="50" cy="7" r="5" fill="url(#nikksOrbGrad)" />
        <circle cx="48.5" cy="5.5" r="1.5" fill="#ffffff" fillOpacity="0.8" />
      </g>

      {/* 2. Miniature Torso & Arms (Compact Rounded 3D Figure) */}
      <g filter="url(#nikksDropShadow)">
        {/* Left Arm / Shoulder */}
        <path
          d="M26 64 C20 67 18 76 22 83 C24 86 28 87 31 82 C34 77 33 69 29 65"
          fill="url(#nikksTorsoGrad)"
        />
        {/* Right Arm / Shoulder */}
        <path
          d="M74 64 C80 67 82 76 78 83 C76 86 72 87 69 82 C66 77 67 69 71 65"
          fill="url(#nikksTorsoGrad)"
        />
        {/* Main Body Capsule */}
        <path
          d="M32 58 C32 58 50 54 68 58 C72 65 74 85 67 92 C60 97 40 97 33 92 C26 85 28 65 32 58 Z"
          fill="url(#nikksTorsoGrad)"
        />
        {/* White Chest Plate Highlight */}
        <path
          d="M36 62 C44 59 56 59 64 62 C66 69 66 78 61 84 C56 89 44 89 39 84 C34 78 34 69 36 62 Z"
          fill="#ffffff"
          fillOpacity="0.25"
        />
        {/* Center Metrology Emblem / Balance Scale */}
        <circle cx="50" cy="74" r="7" fill="#1e1b4b" />
        <circle cx="50" cy="74" r="6" fill="url(#nikksGoldCrest)" />
        {/* Miniature Scale Balance Pictogram on Chest */}
        <path
          d="M50 70 V77 M46 72 H54 M45 74 L47 77 H43 L45 74 Z M55 74 L57 77 H53 L55 74 Z"
          stroke="#1e1b4b"
          strokeWidth="0.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* 3. Ear Cushions / Gold Headset Pods */}
      <rect x="15" y="32" width="7" height="16" rx="3.5" fill="url(#nikksEarGrad)" />
      <rect x="78" y="32" width="7" height="16" rx="3.5" fill="url(#nikksEarGrad)" />

      {/* 4. Cute 3D Robot Head */}
      <g filter="url(#nikksDropShadow)">
        {/* Head Shell (Chubby Cute 3D Capsule) */}
        <rect
          x="20"
          y="16"
          width="60"
          height="46"
          rx="22"
          fill="url(#nikksHeadGrad)"
        />

        {/* Head Top Specular Reflection */}
        <path
          d="M32 20 C42 17 58 17 68 20 C71 21 73 24 70 26 C62 23 48 23 40 25 C34 26 31 22 32 20 Z"
          fill="#ffffff"
          fillOpacity="0.7"
        />

        {/* 5. Visor Screen */}
        <rect
          x="26"
          y="25"
          width="48"
          height="28"
          rx="14"
          fill="url(#nikksVisorGrad)"
          stroke="#4f46e5"
          strokeWidth="1"
        />

        {/* Visor Glass Arc Reflection */}
        <path
          d="M30 30 C38 27 62 27 70 30"
          stroke="#ffffff"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeOpacity="0.3"
        />

        {/* 6. Friendly Expressive Cyan Glowing Eyes (^ ^ curve or open rounded pills) */}
        {/* Left Eye */}
        <ellipse cx="40" cy="38" rx="4" ry="5.5" fill="url(#nikksEyeGrad)" />
        <circle cx="39" cy="36" r="1.5" fill="#ffffff" />
        <circle cx="41.5" cy="40.5" r="0.8" fill="#ffffff" fillOpacity="0.8" />

        {/* Right Eye */}
        <ellipse cx="60" cy="38" rx="4" ry="5.5" fill="url(#nikksEyeGrad)" />
        <circle cx="59" cy="36" r="1.5" fill="#ffffff" />
        <circle cx="61.5" cy="40.5" r="0.8" fill="#ffffff" fillOpacity="0.8" />

        {/* Subtle Cute Pink Cheek Blushes */}
        <circle cx="33" cy="44" r="2.5" fill="#f43f5e" fillOpacity="0.35" />
        <circle cx="67" cy="44" r="2.5" fill="#f43f5e" fillOpacity="0.35" />

        {/* Friendly Visor Smile Accent */}
        <path
          d="M47 44 Q50 47 53 44"
          stroke="#38bdf8"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
};

export default NikksMascotIcon;
