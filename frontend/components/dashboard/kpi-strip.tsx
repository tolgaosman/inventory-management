import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TINTS } from "@/lib/tints";

export interface KpiStripItem {
  icon: LucideIcon;
  tint?: keyof typeof TINTS;
  label: string;
  value: string;
  emphasize?: boolean;
}

/** The five KPI numbers project_description.txt requires front and center. */
export function KpiStrip({ items }: { items: KpiStripItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => {
        const Icon = item.icon;
        const tintKey = item.tint || "blue";
        return (
          <Card
            key={item.label}
            className={cn(
              "flex flex-row items-center gap-3 px-4 py-3.5 gap-y-0",
              item.emphasize && "border-status-critical/30 bg-status-critical/5",
            )}
          >
            <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TINTS[tintKey])}>
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-micro text-muted-foreground">{item.label}</p>
              <p
                className={cn(
                  "text-xl font-semibold tabular-nums text-foreground",
                  item.emphasize && "text-status-critical",
                )}
              >
                {item.value}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
