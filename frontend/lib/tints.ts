/**
 * Icon-chip tints.
 *
 * There are only five *visual* treatments — brand, neutral, positive, warning
 * and critical — all built from theme tokens so they follow light/dark. The
 * long list of colour-named keys below is kept purely so existing call sites
 * (`<KpiTile tint="fuchsia" />`) keep compiling; each one maps onto one of the
 * five. Decorative, non-semantic colour is deliberately gone: a corporate
 * dashboard should not look like a box of crayons.
 *
 * Prefer the semantic names (`brand`, `neutral`, `positive`, `warning`,
 * `critical`) in new code.
 */
const TREATMENTS = {
  brand: "bg-primary/10 text-primary",
  neutral: "bg-muted text-muted-foreground",
  positive: "bg-status-good/10 text-status-good",
  warning: "bg-status-warning/12 text-status-warning-foreground",
  critical: "bg-status-critical/10 text-status-critical",
} as const;

export const TINTS = {
  // Semantic names — use these.
  brand: TREATMENTS.brand,
  neutral: TREATMENTS.neutral,
  positive: TREATMENTS.positive,
  warning: TREATMENTS.warning,
  critical: TREATMENTS.critical,

  // Legacy colour names, mapped onto the five treatments above.
  blue: TREATMENTS.brand,
  indigo: TREATMENTS.brand,
  violet: TREATMENTS.neutral,
  fuchsia: TREATMENTS.neutral,
  pink: TREATMENTS.neutral,
  red: TREATMENTS.critical,
  orange: TREATMENTS.warning,
  amber: TREATMENTS.warning,
  yellow: TREATMENTS.warning,
  green: TREATMENTS.positive,
  teal: TREATMENTS.brand,
  cyan: TREATMENTS.brand,
  sky: TREATMENTS.brand,
} as const;

export type TintName = keyof typeof TINTS;
