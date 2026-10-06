import Image from "next/image";

const WORDMARK_RATIO = 1187 / 314;

/** Official horizontal DropnFly wordmark supplied by the brand. */
export function BrandLogo({
  height = 36,
  className = "",
  priority = false,
}: {
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  const width = Math.round(height * WORDMARK_RATIO);

  return (
    <Image
      src="/brand-logo.png"
      alt="DropnFly logo"
      width={width}
      height={height}
      preload={priority}
      className={`h-auto shrink-0 object-contain ${className}`}
      style={{ width, height }}
    />
  );
}

/** Compact lock mark for square placements such as avatars and app icons. */
export function BrandMark({
  size = 36,
  className = "",
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand-mark.png"
      alt="DropnFly"
      width={size}
      height={size}
      preload={priority}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
