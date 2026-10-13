import * as React from "react";

/**
 * Sunrise Sadhana artwork. All decorative: aria-hidden, scales with width.
 */

type SvgProps = Omit<React.SVGProps<SVGSVGElement>, "viewBox" | "children"> & {
  className?: string;
};

const RAY = "M-9 -170L9 -170L0 -262Z";

function rays(count: number, start = 0) {
  const step = 360 / count;
  return Array.from({ length: count }, (_, i) => start + i * step);
}

/** Single lotus petal path used by the lotus seat and badges. */
const PETAL = "M0 0C-18-14-18-38 0-54 18-38 18-14 0 0Z";

export function SunriseHero({ className, ...rest }: SvgProps) {
  const uid = React.useId().replace(/:/g, "");
  const sky = `sky-${uid}`;
  const sun = `sun-${uid}`;
  const pet = `pet-${uid}`;
  return (
    <svg
      viewBox="0 0 640 620"
      width="100%"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ display: "block", height: "auto" }}
      {...rest}
    >
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F7C9B6" />
          <stop offset="0.55" stopColor="#FBD79B" />
          <stop offset="1" stopColor="#F5A623" />
        </linearGradient>
        <radialGradient id={sun} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFE29A" />
          <stop offset="0.6" stopColor="#F5A623" />
          <stop offset="1" stopColor="#E8792B" />
        </radialGradient>
        <path id={pet} d={PETAL} />
      </defs>
      <rect width="640" height="620" fill={`url(#${sky})`} />
      <g fill="#FFF4E0" opacity=".55">
        <rect x="60" y="86" width="130" height="14" rx="7" />
        <rect x="96" y="108" width="90" height="10" rx="5" />
        <rect x="470" y="64" width="120" height="14" rx="7" />
        <rect x="500" y="86" width="84" height="10" rx="5" />
      </g>
      <g fill="none" stroke="#FFF4E0" opacity=".7">
        <circle cx="320" cy="300" r="290" strokeWidth="2" />
        <circle cx="320" cy="300" r="250" strokeWidth="3" strokeDasharray="1 13" strokeLinecap="round" />
      </g>
      <g fill="#FFF4E0" opacity=".5" transform="translate(320 300)">
        {rays(16).map((a) => (
          <path key={a} d={RAY} transform={`rotate(${a})`} />
        ))}
      </g>
      <circle cx="320" cy="300" r="156" fill="#FFF4E0" opacity=".45" />
      <circle cx="320" cy="300" r="140" fill={`url(#${sun})`} />
      <circle cx="320" cy="300" r="118" fill="none" stroke="#FFF4E0" strokeWidth="2" strokeDasharray="1 9" strokeLinecap="round" opacity=".9" />
      <circle cx="320" cy="300" r="96" fill="none" stroke="#E8792B" strokeWidth="2" opacity=".6" />
      <path d="M470 120c8-10 16-10 22 0M492 120c6-10 14-10 22 0" fill="none" stroke="#3B1F1A" strokeWidth="3" strokeLinecap="round" />
      <path d="M0 410C90 372 170 380 250 404C330 428 420 380 520 384C570 386 610 398 640 410V620H0Z" fill="#EBA07E" />
      <path d="M0 450C80 420 180 426 270 448C380 474 470 430 560 432C600 433 625 440 640 446V620H0Z" fill="#C65D3B" />
      <g fill="#F7C9B6" opacity=".8">
        {[[70, 470], [92, 486], [114, 470], [136, 486], [92, 454], [526, 478], [548, 494], [570, 478], [548, 462]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="4" />
        ))}
      </g>
      <path d="M0 520C110 488 210 470 320 474C430 470 540 488 640 520V620H0Z" fill="#8FAF8A" />
      <path d="M0 560C130 534 230 524 320 526C420 524 520 534 640 560V620H0Z" fill="#6F9470" />
      <ellipse cx="320" cy="470" rx="150" ry="13" fill="#F5A623" />
      <g transform="translate(320 462)">
        {[
          [-108, 1.1], [-86, 1.25], [-64, 1.1], [108, 1.1], [86, 1.25], [64, 1.1],
        ].map(([r, sc]) => (
          <use key={r} href={`#${pet}`} fill="#F7C9B6" stroke="#B8461F" strokeWidth="2" transform={`rotate(${r}) scale(${sc})`} />
        ))}
      </g>
      <g transform="translate(195 238) scale(1.25)">
        <circle cx="100" cy="64" r="58" fill="none" stroke="#FFF4E0" strokeWidth="2.5" strokeDasharray="1 8" strokeLinecap="round" />
        <path d="M76 98C58 118 50 138 54 152" fill="none" stroke="#3B1F1A" strokeWidth="13" strokeLinecap="round" />
        <path d="M124 98C142 118 150 138 146 152" fill="none" stroke="#3B1F1A" strokeWidth="13" strokeLinecap="round" />
        <path d="M70 150C66 112 78 84 100 84C122 84 134 112 130 150Z" fill="#3B1F1A" />
        <rect x="94" y="70" width="12" height="18" rx="5" fill="#3B1F1A" />
        <circle cx="100" cy="58" r="17" fill="#3B1F1A" />
        <circle cx="100" cy="37" r="7" fill="#3B1F1A" />
        <path d="M28 160C28 142 62 138 100 146C138 138 172 142 172 160C172 174 138 176 100 168C62 176 28 174 28 160Z" fill="#3B1F1A" />
        <path d="M82 94L118 132" stroke="#C65D3B" strokeWidth="6" strokeLinecap="round" />
        <path d="M60 160C84 150 120 150 148 162" fill="none" stroke="#C65D3B" strokeWidth="3" strokeLinecap="round" />
        <circle cx="54" cy="153" r="7" fill="#3B1F1A" />
        <circle cx="146" cy="153" r="7" fill="#3B1F1A" />
        <circle cx="100" cy="53" r="2.4" fill="#F5A623" />
      </g>
    </svg>
  );
}

/** Round brand mark: ink disc, marigold half-sun, rays, horizon. */
export function LotusMark({ size = 40, className, ...rest }: SvgProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false" className={className} {...rest}>
      <circle cx="20" cy="20" r="20" fill="#3B1F1A" />
      <path d="M8 26A12 12 0 0 1 32 26Z" fill="#F5A623" />
      <path d="M20 6v4M9 10l3 3M31 10l-3 3M5 20h4M31 20h4" stroke="#F5A623" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M8 29h24" stroke="#FFF4E0" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** Concentric dashed rings with a sun disc, for card corners. */
export function Mandala({
  size = 160,
  rays: showRays = false,
  disc = "#F5A623",
  ring = "#F7C9B6",
  className,
  style,
  ...rest
}: SvgProps & { size?: number; rays?: boolean; disc?: string; ring?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
      {...rest}
    >
      {showRays && (
        <g transform="translate(80 80)" fill="#FFF4E0" opacity=".55">
          {rays(12).map((a) => (
            <path key={a} d="M-5 -50L5 -50L0 -78Z" transform={`rotate(${a})`} />
          ))}
        </g>
      )}
      <circle cx="80" cy="80" r="34" fill={disc} />
      <circle cx="80" cy="80" r="52" fill="none" stroke={ring} strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" />
      <circle cx="80" cy="80" r="70" fill="none" stroke={ring} strokeWidth="2" />
    </svg>
  );
}

/** Layered hill band to sit at the bottom of a section. */
export function HillBand({ className, base = "#8FAF8A", ...rest }: SvgProps & { base?: string }) {
  return (
    <svg
      viewBox="0 0 1200 140"
      width="100%"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ display: "block", height: "auto" }}
      {...rest}
    >
      <path d="M0 60C160 20 300 28 450 58C600 88 760 28 920 34C1040 38 1130 54 1200 66V140H0Z" fill="#EBA07E" opacity=".55" />
      <path d="M0 88C180 56 330 66 500 90C680 116 820 66 980 70C1080 72 1150 84 1200 94V140H0Z" fill="#C65D3B" opacity=".85" />
      <path d="M0 116C200 94 380 90 600 100C800 108 1000 96 1200 116V140H0Z" fill={base} />
    </svg>
  );
}

/** Rangoli dot cluster, decorative accent. */
export function Rangoli({ className, fill = "#F7C9B6", ...rest }: SvgProps & { fill?: string }) {
  return (
    <svg width="72" height="48" viewBox="0 0 72 48" aria-hidden="true" focusable="false" className={className} {...rest}>
      <g fill={fill}>
        {[[8, 24], [24, 40], [40, 24], [56, 40], [24, 8], [64, 12]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="4" />
        ))}
      </g>
    </svg>
  );
}

/** Sun with ray fan. Used as a motif behind streak / class cards. */
export function SunFan({ size = 260, className, style, ...rest }: SvgProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 260 260" aria-hidden="true" focusable="false" className={className} style={style} {...rest}>
      <g transform="translate(130 130)" fill="#FFF4E0" opacity=".55">
        {rays(12).map((a) => (
          <path key={a} d="M-8 -80L8 -80L0 -128Z" transform={`rotate(${a})`} />
        ))}
      </g>
      <circle cx="130" cy="130" r="58" fill="#E8792B" />
      <circle cx="130" cy="130" r="46" fill="none" stroke="#FFF4E0" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" />
    </svg>
  );
}

/** Dashed ring motif for dark (ink) cards. */
export function DarkRings({ size = 300, className, style, ...rest }: SvgProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 300 300" aria-hidden="true" focusable="false" className={className} style={style} {...rest}>
      <g fill="none" stroke="#F5A623" opacity=".3">
        <circle cx="150" cy="150" r="140" strokeWidth="2" />
        <circle cx="150" cy="150" r="115" strokeWidth="3" strokeDasharray="1 9" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Streak emblem: sun disc with dashed rings, children (number) centred over it. */
export function StreakSun({ size = 112, children }: { size?: number; children?: React.ReactNode }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 112 112" aria-hidden="true" focusable="false">
        <circle cx="56" cy="56" r="52" fill="none" stroke="#F5A623" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" opacity=".7" />
        <circle cx="56" cy="56" r="44" fill="#F5A623" />
        <circle cx="56" cy="56" r="36" fill="none" stroke="#3B1F1A" strokeWidth="2" strokeDasharray="1 5" strokeLinecap="round" opacity=".6" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display text-5xl font-bold text-[#3B1F1A]">{children}</div>
    </div>
  );
}

export type EmblemKind = "lotus" | "sun" | "rings" | "flame" | "bloom" | "star";

/** Badge emblem. earned = colourful medallion, otherwise dashed locked medallion. */
export function BadgeEmblem({ kind = "lotus", earned, size = 56 }: { kind?: EmblemKind; earned: boolean; size?: number }) {
  const lotus = (stroke: string, petal: string, centre: string) => (
    <>
      <path d="M31 44C24 39 23 28 31 17 39 28 38 39 31 44Z" fill={centre} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
      <path d="M31 44C22 43 16 37 16 29 25 30 30 36 31 44Z" fill={petal} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
      <path d="M31 44C40 43 46 37 46 29 37 30 32 36 31 44Z" fill={petal} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
    </>
  );
  const sunGlyph = (c: string) => (
    <>
      <path d="M12 40A19 19 0 0 1 50 40Z" fill={earned ? "#F5A623" : "none"} stroke={c} strokeWidth="2" strokeLinejoin="round" />
      <path d="M31 14v6M16 20l4 4M46 20l-4 4M8 33h6M48 33h6M10 44h42" stroke={c} strokeWidth="2.4" strokeLinecap="round" />
    </>
  );
  const rings = (c: string) => (
    <>
      <g fill="none" stroke={c} strokeWidth="2.5">
        <circle cx="31" cy="31" r="15" />
        <circle cx="31" cy="31" r="8" />
      </g>
      <circle cx="31" cy="31" r="2.5" fill={c} />
    </>
  );
  const flame = (c: string) => (
    <path d="M31 12C34 22 42 26 42 36a11 11 0 0 1-22 0c0-6 4-8 5-14 3 2 4 5 4 7 3-3 4-10 2-17Z" fill={earned ? "#F5A623" : "none"} stroke={c} strokeWidth="2.2" strokeLinejoin="round" />
  );
  const star = (c: string) => (
    <>
      <circle cx="31" cy="31" r="7" fill="none" stroke={c} strokeWidth="2.5" />
      <path d="M31 12v8M31 42v8M12 31h8M42 31h8" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
    </>
  );
  const bg = earned
    ? kind === "sun" ? "#E8792B" : kind === "flame" ? "#C65D3B" : "#F5A623"
    : "#F3D9C4";
  const glyphColor = earned ? "#3B1F1A" : "#9A7364";
  let glyph: React.ReactNode;
  switch (kind) {
    case "sun": glyph = sunGlyph(glyphColor); break;
    case "rings": glyph = rings(glyphColor); break;
    case "flame": glyph = flame(glyphColor); break;
    case "bloom": glyph = lotus(glyphColor, earned ? "#F7C9B6" : "none", earned ? "#FFF4E0" : "none"); break;
    case "star": glyph = star(glyphColor); break;
    default: glyph = lotus(glyphColor, earned ? "#F7C9B6" : "none", earned ? "#FFF4E0" : "none");
  }
  return (
    <svg width={size} height={size} viewBox="0 0 62 62" aria-hidden="true" focusable="false">
      {earned ? (
        <circle cx="31" cy="31" r="29" fill={bg} />
      ) : (
        <circle cx="31" cy="31" r="29" fill={bg} stroke="#B88F7A" strokeWidth="2.5" strokeDasharray="4 5" />
      )}
      {glyph}
      {!earned && (
        <>
          <rect x="40" y="38" width="16" height="14" rx="4" fill="#6B4338" />
          <path d="M43 38v-4a5 5 0 0 1 10 0v4" fill="none" stroke="#6B4338" strokeWidth="2.5" />
        </>
      )}
    </svg>
  );
}
