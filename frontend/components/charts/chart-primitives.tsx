"use client";

import { cn } from "@/lib/utils";

/**
 * House chart conventions, in one place.
 *
 * The rules these encode: horizontal-only grid at the border colour, no axis
 * lines or tick marks, no per-point dots (the line is the mark), and a ring
 * `activeDot` that punches through the card colour so it reads on hover. Spread
 * these into Recharts components rather than restating the props per chart —
 * the dashboard drifted three ways before this existed.
 *
 * Colours come from `var(--series-1..3)` so a chart themes itself. Never
 * hardcode a hex here: that is what forced the duplicated
 * `dark:hidden` / `hidden dark:block` line pairs.
 */
export const CHART_GRID = {
  vertical: false,
  horizontal: true,
  stroke: "var(--border)",
  strokeDasharray: "0",
  opacity: 0.6,
} as const;

export const CHART_X_AXIS = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--muted-foreground)", fontSize: 13, fontWeight: 500 },
  tickMargin: 16,
} as const;

export const CHART_Y_AXIS = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--muted-foreground)", fontSize: 12, fontWeight: 500 },
  tickMargin: 8,
} as const;

/** Stroke weight shared by every line series, so no chart reads heavier than another. */
export const CHART_LINE_WIDTH = 3.5;

/** Ring-style hover dot: filled with the series colour, outlined in the card colour. */
export function chartActiveDot(color: string) {
  return { r: 6, fill: color, stroke: "var(--card)", strokeWidth: 2.5 } as const;
}

export interface ChartTooltipRow {
  label: string;
  /** Any CSS colour — pass `var(--series-1)`, not a hex. */
  color: string;
  value: string;
  /** Renders a hairline above this row — for a total or net line. */
  divider?: boolean;
}

/**
 * The glass tooltip. Replaces the Recharts default everywhere; pair it with
 * `cursor={false}` so the hover doesn't also paint a grey column.
 */
export function ChartTooltip({ title, rows }: { title: string; rows: ChartTooltipRow[] }) {
  return (
    <div className="min-w-[150px] rounded-xl border border-border/50 bg-popover/95 p-3.5 text-xs text-popover-foreground shadow-lg backdrop-blur-md">
      <p className="mb-2.5 text-sm font-bold text-foreground">{title}</p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className={cn(
              "flex items-center justify-between gap-5",
              row.divider && "mt-1 border-t border-border/60 pt-2",
            )}
          >
            <span className="flex items-center gap-2 font-medium text-muted-foreground">
              <ChartSwatch color={row.color} />
              {row.label}
            </span>
            <span className="font-bold tabular-nums text-foreground">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The one legend/tooltip swatch shape. */
export function ChartSwatch({ color, className }: { color: string; className?: string }) {
  return <span className={cn("size-2.5 shrink-0 rounded-full", className)} style={{ backgroundColor: color }} />;
}

export interface ChartLegendItem {
  label: string;
  color: string;
}

/**
 * Hand-rolled legend — Recharts' built-in one can't be styled to match. Swatch
 * sits after the label, which is what the dashboard header established.
 */
export function ChartLegend({
  items,
  className,
}: {
  items: ChartLegendItem[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-end gap-2.5">
          <span className="text-[13px] font-semibold text-muted-foreground">{item.label}</span>
          <ChartSwatch color={item.color} />
        </div>
      ))}
    </div>
  );
}
