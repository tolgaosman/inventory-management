import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TINTS, type TintName } from "@/lib/tints";

/**
 * The shared shell behind every "nothing here" surface — empty, error,
 * forbidden, coming-soon. They were four near-identical copies of this markup
 * that drifted apart one tweak at a time; now there is one place to change the
 * treatment and one place it can go wrong.
 *
 * `tone` picks the surface: `muted` for a neutral absence, `destructive` for a
 * failure the user should notice.
 */
export function StatePanel({
  icon: Icon,
  tint = "neutral",
  tone = "muted",
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  tint?: TintName;
  tone?: "muted" | "destructive";
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border px-6 py-16 text-center",
        tone === "destructive" ? "border-destructive/25 bg-destructive/5" : "border-border bg-muted/30",
        className,
      )}
    >
      <div
        className={cn(
          "flex size-10 items-center justify-center rounded-lg",
          tone === "destructive" ? "bg-destructive/10 text-destructive" : TINTS[tint],
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
