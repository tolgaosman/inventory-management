import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TINTS } from "@/lib/tints";

export interface KpiMetaItem {
  icon: LucideIcon;
  tint?: keyof typeof TINTS;
  label: string;
  value: string;
}

/**
 * Secondary KPI pills — every metric that used to live in the "Envanter &
 * Tedarik Özeti" / "Katalog & Stok Sağlığı" table cards, kept visible in a
 * single scrollable row instead of disappearing during the redesign.
 */
export function KpiMetaBar({ items }: { items: KpiMetaItem[] }) {
  return (
    <div className="flex items-stretch gap-2 overflow-x-auto custom-scrollbar rounded-xl border border-border bg-card px-3 py-2.5">
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
