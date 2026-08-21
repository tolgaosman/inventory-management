import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TINTS, type TintName } from "@/lib/tints";

export interface StatCardProps {
  icon: LucideIcon;
  tint?: TintName;
  label: string;
  value: string;
  /** Pulls the card into the critical treatment — for a number that needs acting on. */
  emphasize?: boolean;
  className?: string;
}

/**
 * The single KPI card recipe for the whole app.
 *
 * One tint chip, one micro label, one tabular number. Numbers are always
 * `tabular-nums` so a column of them stays aligned while the value changes.
 * `emphasize` is the only variant: it is for a count that demands attention
 * (critical stock), never for decoration.
 */
export function StatCard({ icon: Icon, tint = "blue", label, value, emphasize, className }: StatCardProps) {
  return (
    <Card
      className={cn(
        "flex flex-row items-center gap-3 px-4 py-3.5 gap-y-0",
        emphasize && "border-status-critical/30 bg-status-critical/5",
        className,
      )}
    >
      <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TINTS[tint])}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 leading-tight text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn("truncate text-xl font-semibold tabular-nums text-foreground", emphasize && "text-status-critical")}>
          {value}
        </p>
      </div>
    </Card>
  );
}

/**
 * Responsive KPI row. Defaults to the dashboard's five-up rhythm; pass
 * `className` to override the column counts for a shorter row.
 */
export function StatGrid({
  items,
  className,
}: {
  items: StatCardProps[];
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5", className)}>
      {items.map((item) => (
        <StatCard key={item.label} {...item} />
      ))}
    </div>
  );
}
