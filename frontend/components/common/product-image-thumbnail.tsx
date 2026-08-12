"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductImageThumbnailProps {
  src?: string;
  alt?: string;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

const SIZE_CLASSES = {
  xs: "size-7 rounded-md",
  sm: "size-9 rounded-md",
  md: "size-12 rounded-md",
  lg: "size-16 rounded-lg",
  xl: "size-24 rounded-lg",
};

const ICON_SIZES = {
  xs: "size-3.5",
  sm: "size-4",
  md: "size-5",
  lg: "size-7",
  xl: "size-10",
};

export function ProductImageThumbnail({
  src,
  alt = "Ürün Görseli",
  className,
  size = "sm",
}: ProductImageThumbnailProps) {
  const [error, setError] = useState(false);

  const showImage = Boolean(src && !error);
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.sm;
  const iconSizeClass = ICON_SIZES[size] ?? ICON_SIZES.sm;

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden border border-border bg-muted/50 text-muted-foreground dark:bg-muted/30",
        sizeClass,
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          onError={() => setError(true)}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground/60">
          <Package className={iconSizeClass} />
        </div>
      )}
    </div>
  );
}
