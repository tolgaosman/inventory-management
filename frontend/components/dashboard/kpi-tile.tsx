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
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl transition-all hover:scale-105", TINTS[tint])}>
        <Icon className="size-[18px]" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-lg font-semibold tracking-tight">{value}</p>
      </div>
    </div>
  );
}
