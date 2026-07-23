import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

export function SearchIcon({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function SunIcon({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function CandlesIcon({ size = 15, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M7 3v4M7 13v8M17 3v10M17 17v4" />
      <rect x="5" y="7" width="4" height="6" rx="0.5" />
      <rect x="15" y="13" width="4" height="4" rx="0.5" />
    </svg>
  );
}

export function IndicatorsIcon({ size = 15, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M3 17l5-6 4 3 5-8 4 5" />
    </svg>
  );
}

export function UndoIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M9 7L4 12l5 5" />
      <path d="M4 12h11a5 5 0 0 1 0 10h-1" />
    </svg>
  );
}

export function RedoIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M15 7l5 5-5 5" />
      <path d="M20 12H9a5 5 0 0 0 0 10h1" />
    </svg>
  );
}

export function MagnetIcon({ size = 15, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M6 4v7a6 6 0 0 0 12 0V4" />
      <path d="M6 4H3M18 4h3M6 8H3M18 8h3" />
    </svg>
  );
}

export function GearIcon({ size = 15, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z" />
    </svg>
  );
}

export function ExpandIcon({ size = 15, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" />
    </svg>
  );
}

export function CameraIcon({ size = 15, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}

export function DepthFullIcon({ size = 15, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p} strokeWidth={1.4}>
      <rect x="3" y="5" width="18" height="4" rx="0.5" />
      <rect x="3" y="10" width="18" height="4" rx="0.5" />
      <rect x="3" y="15" width="18" height="4" rx="0.5" />
    </svg>
  );
}

export function DepthBuyIcon({ size = 15, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p} strokeWidth={1.4}>
      <rect x="3" y="6" width="18" height="12" rx="0.5" />
      <path d="M3 12h18" />
    </svg>
  );
}

export function DepthSplitIcon({ size = 15, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p} strokeWidth={1.4}>
      <rect x="3" y="6" width="8.4" height="12" rx="0.5" />
      <rect x="12.6" y="6" width="8.4" height="12" rx="0.5" />
    </svg>
  );
}

export function LockIcon({ size = 15, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function MinusIcon({ size = 12, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function PlusIcon({ size = 12, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function SlidersIcon({ size = 15, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h14M22 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="7" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}

export function NebulaLogo({ size = 22, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...p}>
      <defs>
        <linearGradient id="nebula-bg" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>
        <linearGradient id="nebula-ring" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f0abfc" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        <radialGradient id="nebula-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="100%" stopColor="#f0abfc" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#nebula-bg)" />
      <ellipse
        cx="12"
        cy="12"
        rx="7.5"
        ry="3.4"
        transform="rotate(-32 12 12)"
        stroke="url(#nebula-ring)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeDasharray="20 3.5"
      />
      <circle cx="12" cy="12" r="2.4" fill="url(#nebula-core)" />
      <circle cx="17.5" cy="6.5" r="0.9" fill="#fff" />
      <circle cx="6" cy="17" r="0.6" fill="#fff" fillOpacity="0.7" />
    </svg>
  );
}

export function BitcoinGlyph({ size = 22, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="12" cy="12" r="11" fill="#f0b90b" />
      <path
        d="M9.5 6.8h3.6c1.6 0 2.7.8 2.7 2.2 0 1-.6 1.7-1.5 1.9 1.1.2 1.9 1 1.9 2.2 0 1.6-1.3 2.4-3 2.4H9.5v-1.6h.9V8.4h-.9V6.8Zm2.4 3.6h1.2c.8 0 1.2-.4 1.2-1s-.4-1-1.2-1h-1.2v2Zm0 3.7h1.4c.9 0 1.4-.4 1.4-1.1 0-.7-.5-1.1-1.4-1.1h-1.4v2.2Z"
        fill="#0a0b0d"
      />
      <path d="M11 5.4v1.6M13.2 5.4v1.6M11 16.9v1.6M13.2 16.9v1.6" stroke="#0a0b0d" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

export function FireEmoji({ size = 14 }: { size?: number }) {
  return <span style={{ fontSize: size, lineHeight: 1 }}>🔥</span>;
}
