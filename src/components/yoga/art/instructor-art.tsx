import * as React from "react";

/** Decorative instructor-workspace artwork. All aria-hidden. */

type SvgProps = Omit<React.SVGProps<SVGSVGElement>, "viewBox" | "children">;

/** Rising sun with rays and a terracotta hill, for the Today greeting header. */
export function HeaderSun({ className, ...rest }: SvgProps) {
  return (
    <svg width="240" height="150" viewBox="0 0 240 150" fill="none" aria-hidden="true" focusable="false" className={className} {...rest}>
      <g transform="translate(130 150)" stroke="#E8792B" strokeWidth="4" strokeLinecap="round" opacity=".7">
        <path d="M0 -78V-108" />
        <path d="M-55 -55L-76 -76" />
        <path d="M55 -55L76 -76" />
        <path d="M-78 0H-108" />
        <path d="M78 0H108" />
      </g>
      <path d="M70 150A60 60 0 0 1 190 150Z" fill="#F5A623" />
      <path d="M92 150A38 38 0 0 1 168 150" stroke="#FFF4E0" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" />
      <path d="M0 150Q40 120 90 140T240 130V150Z" fill="#C65D3B" opacity=".55" />
    </svg>
  );
}

/** Five-petal bloom for rating / feedback cards. */
export function PetalBloom({ size = 90, className, ...rest }: SvgProps & { size?: number }) {
  const petal = "M0 -36Q10 -16 0 -2Q-10 -16 0 -36Z";
  return (
    <svg width={size} height={size} viewBox="-45 -45 90 90" aria-hidden="true" focusable="false" className={className} {...rest}>
      <g fill="#F7C9B6" stroke="#E8792B" strokeWidth="2" strokeLinejoin="round">
        {[0, 45, -45, 90, -90].map((a) => (
          <path key={a} d={petal} transform={`rotate(${a})`} />
        ))}
      </g>
      <circle r="6" fill="#F5A623" />
    </svg>
  );
}
