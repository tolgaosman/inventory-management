/**
 * Icon-chip tints.
 *
 * Six accent tones — blue, teal, plum, amber, green, red — all drawn from one
 * saturation/lightness recipe (see `--tint-*` in globals.css) so they read as
 * one palette rather than a colour picker. The long list of colour-named
 * keys below exists purely so existing call sites (`<KpiTile tint="fuchsia" />`)
 * keep compiling; each maps onto one of the six, chosen for maximum spread
 * so adjacent KPI tiles don't collapse onto the same hue.
 *
 * Prefer the six tone names (`blue`, `teal`, `plum`, `amber`, `green`, `red`)
 * or the semantic aliases (`brand`, `positive`, `warning`, `critical`) in new
 * code. `neutral` is reserved for genuinely non-semantic chips (e.g. a
 * disabled/passive state) — it is the only grey option.
 */
const TREATMENTS = {
  blue: "bg-tint-blue/10 text-tint-blue",
  teal: "bg-tint-teal/10 text-tint-teal",
  plum: "bg-tint-plum/10 text-tint-plum",
  amber: "bg-tint-amber/12 text-tint-amber",
  green: "bg-tint-green/10 text-tint-green",
  red: "bg-tint-red/10 text-tint-red",
  neutral: "bg-muted text-muted-foreground",
} as const;

export const TINTS = {
  // Tone names — use these.
  blue: TREATMENTS.blue,
  teal: TREATMENTS.teal,
  plum: TREATMENTS.plum,
  amber: TREATMENTS.amber,
  green: TREATMENTS.green,
  red: TREATMENTS.red,
  neutral: TREATMENTS.neutral,

  // Semantic aliases.
  brand: TREATMENTS.blue,
  positive: TREATMENTS.green,
  warning: TREATMENTS.amber,
  critical: TREATMENTS.red,

  // Legacy colour names, spread across the six tones (not collapsed to one).
  indigo: TREATMENTS.blue,
  sky: TREATMENTS.blue,
  cyan: TREATMENTS.teal,
  violet: TREATMENTS.plum,
  fuchsia: TREATMENTS.plum,
  pink: TREATMENTS.plum,
  orange: TREATMENTS.amber,
  yellow: TREATMENTS.amber,
} as const;

export type TintName = keyof typeof TINTS;
