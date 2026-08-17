/**
 * Colour a fill-level indicator (warehouse capacity, per-warehouse stock
 * against min level, …) by how full/critical it is, instead of always
 * rendering the same brand colour regardless of value.
 */
export function capacityTone(percent: number): "green" | "amber" | "red" {
  if (percent >= 90) return "red";
  if (percent >= 70) return "amber";
  return "green";
}

/** Tailwind class for a `ProgressIndicator` fill at the given percent. */
export function capacityIndicatorClass(percent: number): string {
  const tone = capacityTone(percent);
  return tone === "red" ? "bg-tint-red" : tone === "amber" ? "bg-tint-amber" : "bg-tint-green";
}

/** CSS colour (for SVG `fill`/`stroke`) matching `capacityIndicatorClass`'s tone. */
export function capacityFillVar(percent: number): string {
  const tone = capacityTone(percent);
  return tone === "red" ? "var(--tint-red)" : tone === "amber" ? "var(--tint-amber)" : "var(--tint-green)";
}
