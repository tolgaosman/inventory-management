import { Children, isValidElement, cloneElement } from "react";
import { cn } from "@/lib/utils";

/**
 * Entrance stagger for a page section.
 *
 * CSS animations fire on mount only, and a page subtree should mount exactly
 * once: `useAsync` keeps `staleData` during a refetch, so a filter change
 * re-renders in place instead of remounting. The intro therefore plays on
 * first load and never replays on filter changes, which is the difference
 * between one authored moment and the same entrance firing at every keystroke.
 * `animationFillMode: backwards` holds the pre-animation state during the
 * delay so nothing flashes in before its turn.
 *
 * Gate a refetch with `opacity-60 transition-opacity` on the wrapper instead of
 * remounting — remounting replays every stagger and reads as a page flash.
 */
export function Section({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("animate-in fade-in slide-in-from-bottom-2 duration-[260ms] ease-out-strong", className)}
      style={{ animationDelay: `${index * 40}ms`, animationFillMode: "backwards" }}
    >
      {children}
    </div>
  );
}

/**
 * Vertical stack that hands each `<Section>` child its own `index`, so pages
 * don't hand-count them and can reorder sections without renumbering.
 * Children that aren't `Section` (a conditional `null`, a raw node) pass
 * through untouched and don't consume an index.
 */
export function SectionStack({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  let index = 0;

  return (
    <div className={cn("space-y-4", className)}>
      {Children.map(children, (child) => {
        if (!isValidElement(child) || child.type !== Section) return child;
        return cloneElement(child as React.ReactElement<{ index: number }>, { index: index++ });
      })}
    </div>
  );
}
