import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TINTS = {
  blue: "bg-[#e7f0fb] text-[#2a78d6]",
  orange: "bg-[#fdece3] text-[#eb6834]",
  green: "bg-[#e5f6ee] text-[#1baf7a]",
  violet: "bg-[#ece9fa] text-[#4a3aa7]",
  red: "bg-[#fbe9e9] text-[#d03b3b]",
  yellow: "bg-[#fdf1dc] text-[#a4720a]",
} as const;

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
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", TINTS[tint])}>
        <Icon className="size-[18px]" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}
