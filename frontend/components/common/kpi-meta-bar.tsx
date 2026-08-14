import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TINTS, type TintName } from "@/lib/tints";

export interface KpiMetaItem {
  icon: LucideIcon;
  tint?: TintName;
  label: string;
  value: string;
}

/**
 * Secondary metrics in a single scrollable row.
 *
 * The counterpart to `StatGrid`: use that for the handful of numbers a page is
 * about, and this for the long tail that still needs to be visible but doesn't
 * deserve a card each.
 */
export function KpiMetaBar({ items, className }: { items: KpiMetaItem[]; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-stretch gap-2 overflow-x-auto custom-scrollbar rounded-xl border border-border bg-card px-3 py-2.5",
        className,
      )}
    >
      {items.map((item, idx) => {
        const Icon = item.icon;
        const tintKey = item.tint || "blue";
        return (
          <div key={item.label} className="flex shrink-0 items-center gap-2">
            <div className="flex items-center gap-2 px-2">
              <div className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", TINTS[tintKey])}>
                <Icon className="size-3.5" />
              </div>
              <div className="whitespace-nowrap">
                <span className="text-xs text-muted-foreground">{item.label}</span>{" "}
                <span className="text-xs font-semibold tabular-nums text-foreground">{item.value}</span>
              </div>
            </div>
            {idx !== items.length - 1 && <span className="my-1 w-px shrink-0 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}
