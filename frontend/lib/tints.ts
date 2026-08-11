/**
 * Shared pastel/dark tint pairs for icon chips across the app — originally
 * defined in `components/dashboard/kpi-tile.tsx`, hoisted here so other
 * pages (e.g. Ayarlar) can use the exact same palette instead of inventing
 * their own colors.
 */
export const TINTS = {
  blue: "bg-[#e7f0fb] text-[#2a78d6] dark:bg-blue-950/40 dark:text-blue-400",
  indigo: "bg-[#e8ebff] text-[#4f46e5] dark:bg-indigo-950/40 dark:text-indigo-400",
  violet: "bg-[#ece9fa] text-[#4a3aa7] dark:bg-violet-950/40 dark:text-violet-400",
  fuchsia: "bg-[#fbe8f6] text-[#c026d3] dark:bg-fuchsia-950/40 dark:text-fuchsia-400",
  pink: "bg-[#fce7f3] text-[#db2777] dark:bg-pink-950/40 dark:text-pink-400",
  red: "bg-[#fbe9e9] text-[#d03b3b] dark:bg-red-950/40 dark:text-red-400",
  orange: "bg-[#fdece3] text-[#eb6834] dark:bg-orange-950/40 dark:text-orange-400",
  amber: "bg-[#fef3c7] text-[#d97706] dark:bg-amber-950/40 dark:text-amber-400",
  yellow: "bg-[#fdf1dc] text-[#a4720a] dark:bg-yellow-950/40 dark:text-yellow-400",
  green: "bg-[#e5f6ee] text-[#1baf7a] dark:bg-emerald-950/40 dark:text-emerald-400",
  teal: "bg-[#ccfbf1] text-[#0d9488] dark:bg-teal-950/40 dark:text-teal-400",
  cyan: "bg-[#e0f2fe] text-[#0284c7] dark:bg-cyan-950/40 dark:text-cyan-400",
  sky: "bg-[#e0f2fe] text-[#0369a1] dark:bg-sky-950/40 dark:text-sky-400",
} as const;

export type TintName = keyof typeof TINTS;
