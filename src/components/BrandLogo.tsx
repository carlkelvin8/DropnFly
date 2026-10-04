import Image from "next/image";

/** Official DropnFly mark (public/logo.svg). Square asset — size via the `size` prop to keep its aspect ratio. */
export function BrandLogo({ size = 36, className = "", priority = false }: { size?: number; className?: string; priority?: boolean }) {
  return (
    <Image
      src="/logo.svg"
      alt="DropnFly logo"
      width={size}
      height={size}
      priority={priority}
      unoptimized
      className={`shrink-0 rounded-xl ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
