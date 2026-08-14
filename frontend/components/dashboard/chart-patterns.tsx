import React from "react";

/**
 * Shared SVG patterns and gradients for the clone cards.
 *
 * `id` is required and must be unique per rendered instance.
 */
export function ChartPatternDefs({ id }: { id: string }) {
  return (
    <defs>
      {/* 1. Solid Dark */}
      <pattern id={`${id}-solid-dark`} width={100} height={100} patternUnits="userSpaceOnUse">
        <rect width={100} height={100} fill="#0f0f13" />
      </pattern>

      {/* 2. Thick Diagonal Stripes */}
      <pattern
        id={`${id}-thick-stripes`}
        width={10}
        height={10}
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width={10} height={10} fill="transparent" />
        <line x1={0} y1={0} x2={0} y2={10} stroke="#0f0f13" strokeWidth={5} />
      </pattern>

      {/* 3. Noise / Grain */}
      <filter id={`${id}-noise-filter`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="1 0 0 0 0, 0 1 0 0 0, 0 0 1 0 0, 0 0 0 0.8 0" />
      </filter>
      <pattern id={`${id}-noise`} width={100} height={100} patternUnits="userSpaceOnUse">
        <rect width={100} height={100} fill="#0f0f13" />
        <rect width={100} height={100} filter={`url(#${id}-noise-filter)`} opacity={0.6} style={{ mixBlendMode: "overlay" }} />
      </pattern>

      {/* 4. Gradient Fade (Dark to transparent) */}
      <linearGradient id={`${id}-gradient-fade`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0f0f13" stopOpacity="1" />
        <stop offset="100%" stopColor="#0f0f13" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
}

export type PatternKind = "solid-dark" | "thick-stripes" | "noise" | "gradient-fade";

export function patternFill(id: string, kind: PatternKind) {
  return `url(#${id}-${kind})`;
}
