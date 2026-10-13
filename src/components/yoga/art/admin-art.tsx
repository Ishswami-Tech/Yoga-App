import * as React from "react";

/** Decorative art for the admin console. All aria-hidden. */

type P = { className?: string; style?: React.CSSProperties };

/** Half sun with rays, used on the right of page headers. */
export function HeaderSun({ className, style }: P) {
  return (
    <svg aria-hidden="true" width="150" height="80" viewBox="0 0 150 80" className={className} style={style}>
      <g stroke="#F5A623" strokeWidth="3" strokeLinecap="round" opacity=".7">
        <path d="M75 4v12M32 20l8 8M118 20l-8 8M8 52h12M130 52h12" />
      </g>
      <path d="M35 76A40 40 0 0 1 115 76Z" fill="#F5A623" />
      <path d="M50 76A25 25 0 0 1 100 76" fill="none" stroke="#FFF4E0" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" />
    </svg>
  );
}

/** Corner sun for "today" cards. */
export function CornerSun({ className, style }: P) {
  return (
    <svg aria-hidden="true" width="90" height="90" viewBox="0 0 90 90" className={className} style={style}>
      <g stroke="#F5A623" strokeWidth="3" strokeLinecap="round">
        <path d="M45 6v8M45 76v8M6 45h8M76 45h8M18 18l6 6M66 66l6 6M72 18l-6 6M24 66l-6 6" />
      </g>
      <circle cx="45" cy="45" r="16" fill="#F5A623" />
    </svg>
  );
}

/** Concentric dotted rings for dark panels. */
export function AdminRings({ className, style, size = 300 }: P & { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 300 300" className={className} style={style}>
      <g fill="none" stroke="#F5A623" opacity=".28">
        <circle cx="150" cy="150" r="140" strokeWidth="2" />
        <circle cx="150" cy="150" r="112" strokeWidth="3" strokeDasharray="1 10" strokeLinecap="round" />
        <circle cx="150" cy="150" r="84" strokeWidth="2" />
        <circle cx="150" cy="150" r="56" strokeWidth="3" strokeDasharray="1 10" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Initials avatar in a rotating sunrise tint. */
const TINTS = ["#F5A623", "#F7C9B6", "#E8792B", "#8FAF8A", "#FDE7CC"];
export function InitialsDot({ name, size = 36 }: { name: string; size?: number }) {
  const parts = (name || "?").trim().split(/\s+/);
  const ini = ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-extrabold text-[#3B1F1A]"
      style={{ width: size, height: size, background: TINTS[h % TINTS.length], fontSize: Math.round(size * 0.34) }}
    >
      {ini}
    </span>
  );
}

/** Sun-and-rings corner for instructor cards. */
export function InstructorRings({ className, style }: P) {
  return (
    <svg aria-hidden="true" width="140" height="140" viewBox="0 0 140 140" className={className} style={style}>
      <g fill="none" stroke="#F5A623" opacity=".5">
        <circle cx="70" cy="70" r="64" strokeWidth="2" />
        <circle cx="70" cy="70" r="46" strokeWidth="3" strokeDasharray="1 8" strokeLinecap="round" />
      </g>
      <circle cx="70" cy="70" r="26" fill="#F5A623" opacity=".55" />
    </svg>
  );
}

/** Soft rings for membership / subscription panels. */
export function MembershipRings({ className, style }: P) {
  return (
    <svg aria-hidden="true" width="150" height="150" viewBox="0 0 150 150" className={className} style={style}>
      <g fill="none" stroke="#E8792B" opacity=".4">
        <circle cx="75" cy="75" r="68" strokeWidth="2" />
        <circle cx="75" cy="75" r="50" strokeWidth="3" strokeDasharray="1 8" strokeLinecap="round" />
      </g>
      <circle cx="75" cy="75" r="30" fill="#F5A623" opacity=".6" />
    </svg>
  );
}
