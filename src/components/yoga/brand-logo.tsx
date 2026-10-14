import Image from "next/image";
import { APP_NAME } from "@/lib/brand";

/**
 * The brand emblem (public/logo-mark.png). Pass `plate` on dark backgrounds: the navy parts of the
 * emblem would disappear there, so it sits on a cream disc.
 */
export function BrandLogo({
  size = 40,
  plate = false,
  className = "",
  priority = false,
}: {
  size?: number;
  plate?: boolean;
  className?: string;
  priority?: boolean;
}) {
  const image = (
    <Image
      src="/logo-mark.png"
      alt={APP_NAME}
      width={size}
      height={size}
      priority={priority}
      className={plate ? "" : className}
      style={{ width: size, height: size }}
    />
  );
  if (!plate) return image;
  return (
    <span
      className={`inline-grid place-items-center rounded-full bg-[#FFF4E0] ${className}`}
      style={{ width: size + 8, height: size + 8 }}
    >
      {image}
    </span>
  );
}
