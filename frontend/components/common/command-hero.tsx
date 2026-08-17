"use client";

import type { LucideIcon } from "lucide-react";
import { PanelCard } from "@/components/common/panel-card";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

export interface CommandHeroChip {
  key: string;
  icon: LucideIcon;
  label: string;
  value: number | string | undefined;
  onClick: () => void;
}

const CHIP_GRID_CLASS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
};

/**
 * The command-center hero every "flagship" list page opens with: a dark
 * `PanelCard variant="inverse"` (the surface used exactly once elsewhere in
 * the app, on `/panel`'s category donut) with a big headline number, a
 * 10-tick fill meter, and a row of filter-shortcut chips.
 *
 * Extracted from `purchase-command-hero.tsx` so every page that adopts this
 * pattern shares one implementation. Every number stays reserved-width and
 * shows "—" while loading so the hero never shifts layout; every chip is a
 * filter shortcut, not decoration — it disables itself when its value is
 * falsy/undefined instead of showing a dead button.
 */
export function CommandHero({
  title,
  headlineLabel,
  headlineValue,
  meterLabel,
  meterPercent,
  meterValueLabel,
  chips,
}: {
  title: string;
  headlineLabel: string;
  headlineValue: string | undefined;
  meterLabel?: string;
  meterPercent?: number;
  meterValueLabel?: string;
  chips: CommandHeroChip[];
}) {
  const filledTicks = Math.round((meterPercent ?? 0) / 10);
  const showMeter = meterLabel !== undefined;

  return (
    <PanelCard variant="inverse" title={title} className="shadow-hero">
      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-xl font-bold tracking-tight text-surface-inverse-foreground/70">{headlineLabel}</p>
          <span className="flex items-baseline text-[42px] font-bold leading-none tracking-tight tabular-nums text-surface-inverse-foreground">
            {headlineValue ?? "—"}
          </span>
        </div>

        {showMeter && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-surface-inverse-foreground/70 sm:text-right">{meterLabel}</p>
            <div className="flex items-center gap-3 sm:justify-end">
              <div className="flex h-6 items-end gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 rounded-full"
                    style={{
                      height: i < filledTicks ? "100%" : "40%",
                      backgroundColor: i < filledTicks ? "var(--slice-1)" : "var(--surface-inverse-muted)",
                    }}
                  />
                ))}
              </div>
              <span className="text-lg font-bold tabular-nums text-surface-inverse-foreground">
                {meterValueLabel ?? "—"}
              </span>
            </div>
          </div>
        )}
      </div>

      <div
        className={cn(
          "mt-6 grid gap-2 border-t border-surface-inverse-border pt-5",
          CHIP_GRID_CLASS[chips.length] ?? "grid-cols-2 sm:grid-cols-4",
        )}
      >
        {chips.map((chip) => {
          const disabled = !chip.value;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onClick}
              disabled={disabled}
              className={cn(
                "flex items-center gap-2.5 rounded-lg bg-surface-inverse-muted px-3 py-2.5 text-left backdrop-blur-sm transition-colors",
                disabled ? "cursor-default opacity-40" : "hover:bg-surface-inverse-border",
              )}
            >
              <chip.icon className="size-4 shrink-0 text-surface-inverse-foreground/80" />
              <span className="min-w-0">
                <span className="block text-base font-bold tabular-nums text-surface-inverse-foreground">
                  {chip.value === undefined ? "—" : typeof chip.value === "number" ? formatNumber(chip.value) : chip.value}
                </span>
                <span className="block truncate text-micro text-surface-inverse-foreground/70">{chip.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </PanelCard>
  );
}
