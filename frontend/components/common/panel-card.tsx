import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type PanelVariant = "default" | "hero" | "inverse";

/**
 * The card shell every panel in the app is built from.
 *
 * Three archetypes:
 *   default — a titled list/table panel sitting in the page flow (border, no shadow)
 *   hero    — a borderless chart surface with generous padding
 *   inverse — a deliberately dark surface that stays dark in BOTH themes
 *
 * Note there is no `py-5`/`px-5` here: `ui/card.tsx` already sets
 * `[--card-spacing:--spacing(5)]` and applies it to the card, header and
 * content. Restating it is a no-op, and `<Card size="sm">` is how you get the
 * tighter 16px rhythm.
 *
 * Never nest a PanelCard inside a PanelCard — separate regions with a hairline
 * `border-b border-border` and spacing instead.
 */
export function PanelCard({
  title,
  meta,
  actions,
  variant = "default",
  className,
  headerClassName,
  bodyClassName,
  children,
}: {
  /** Panel title. Omit for an untitled surface (a bare chart, a form). */
  title?: React.ReactNode;
  /** Muted trailing text in the title row — a count, a unit, a timestamp. */
  meta?: React.ReactNode;
  /** Interactive trailing element — a link, a button, a select. */
  actions?: React.ReactNode;
  variant?: PanelVariant;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  if (variant !== "default") {
    return (
      <Card
        className={cn(
          "flex h-full w-full flex-col overflow-hidden border-0",
          variant === "hero" && "bg-card p-6 shadow-soft sm:p-8",
          variant === "inverse" && "bg-surface-inverse p-5 text-surface-inverse-foreground shadow-hero",
          className,
        )}
      >
        {(title || meta || actions) && (
          <div className={cn("relative z-10 flex items-center justify-between gap-3", headerClassName)}>
            {title && (
              <span
                className={cn(
                  "text-xl font-medium tracking-tight",
                  variant === "hero" && "font-bold text-muted-foreground",
                )}
              >
                {title}
              </span>
            )}
            {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
            {actions}
          </div>
        )}
        <div className={cn("relative z-10 flex min-h-0 flex-1 flex-col", bodyClassName)}>{children}</div>
      </Card>
    );
  }

  return (
    <Card className={cn("flex h-full flex-col", className)}>
      {(title || meta || actions) && (
        <CardHeader className={cn("pb-2", actions && "flex-row items-center justify-between gap-3", headerClassName)}>
          <CardTitle className="flex items-center justify-between gap-3 text-base font-semibold tracking-tight text-foreground">
            <span className="min-w-0 truncate">{title}</span>
            {meta && <span className="shrink-0 text-xs font-normal text-muted-foreground">{meta}</span>}
          </CardTitle>
          {actions}
        </CardHeader>
      )}
      <CardContent className={cn("min-h-0 flex-1", bodyClassName)}>{children}</CardContent>
    </Card>
  );
}

/**
 * The glass square used for an icon or control on an `inverse` panel. Uses the
 * inverse-surface tokens rather than `bg-white/10` so it tracks the surface if
 * the surface is ever re-toned.
 */
export function HeroChip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex size-8 items-center justify-center rounded-lg bg-surface-inverse-muted backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
