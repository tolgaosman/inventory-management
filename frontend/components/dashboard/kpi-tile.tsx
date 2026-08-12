import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TINTS } from "@/lib/tints";

export function KpiTile({
  icon: Icon,
  tint = "blue",
  label,
  value,
}: {
  icon: LucideIcon;
  tint?: keyof typeof TINTS;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", TINTS[tint])}>
        <Icon className="size-[18px]" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}
