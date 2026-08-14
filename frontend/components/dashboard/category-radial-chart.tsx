import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { CategoryShare } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { HeroChip, PanelCard } from "@/components/common/panel-card";
import { PieChart, Pie, Cell, Sector, ResponsiveContainer } from "recharts";
import type { PieSectorShapeProps } from "recharts/types/polar/Pie";

/**
 * Slice palette. These are surface-relative, not theme-relative: the donut
 * always sits on `--surface-inverse`, which is dark in both themes, so the
 * slices barely move between them. They are deliberately not `--chart-*`,
 * which is validated against a white card and would disappear here.
 */
const SLICE_COLORS = [
  "var(--slice-1)", // Crisp white for the largest slice
  "var(--slice-2)", // Light sky blue
  "var(--slice-3)", // Light cyan / turquoise
  "var(--slice-4)", // Light emerald
];

/**
 * The geometry Recharts hands the `shape` render prop. `PieSectorShapeProps`
 * leaves every field optional and doesn't know about our payload, so this
 * narrows it to what the active-slice grow-out actually reads.
 */
type SliceShapeProps = PieSectorShapeProps & { payload?: { categoryId?: string } };

export function CategoryRadialChart({ shares }: { shares: CategoryShare[] }) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const allShares = shares ?? [];
    if (allShares.length <= 4) return allShares;
    
    const top3 = allShares.slice(0, 3);
    const otherUnits = allShares.slice(3).reduce((sum, c) => sum + c.units, 0);
    
    return [
      ...top3,
      { categoryId: "other", name: "Diğer", units: otherUnits }
    ];
  }, [shares]);
  
  const totalUnits = useMemo(() => (shares ?? []).reduce((s, c) => s + c.units, 0), [shares]);

  const slices = categories.reduce<
    Array<(typeof categories)[number] & { color: string }>
  >((acc, cat, idx) => {
    acc.push({ 
      ...cat,
      color: SLICE_COLORS[idx % SLICE_COLORS.length] 
    });
    return acc;
  }, []);

  const activeCat = categories.find((c) => c.categoryId === hoveredCategory);

  return (
    <PanelCard
      variant="inverse"
      title="Stok Dağılımı"
      className="relative"
      actions={
        <HeroChip>
          <SlidersHorizontal className="size-4 text-surface-inverse-foreground/90" />
        </HeroChip>
      }
    >
      {categories.length === 0 ? (
        <div className="relative z-10 flex flex-1 items-center justify-center py-10 text-center text-sm text-surface-inverse-foreground/75">
          Henüz kategori stok verisi yok.
        </div>
      ) : (
        <div className="flex-1 mt-8 relative">
          <div className="relative z-10 flex-1 space-y-3 pt-6 w-[62%] pr-2">
            {slices.map((c) => {
              const isHovered = hoveredCategory === c.categoryId;
              return (
                <div
                  key={c.categoryId}
                  onMouseEnter={() => setHoveredCategory(c.categoryId)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  className={cn(
                    "flex items-center gap-3 cursor-pointer transition-all duration-200",
                    hoveredCategory && !isHovered ? "opacity-40" : "opacity-100"
                  )}
                >
                  <div 
                    className="size-3.5 rounded-full shadow-sm" 
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="text-[13px] font-medium leading-snug text-surface-inverse-foreground/90 truncate">
                    {c.name}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Recharts Pie Chart */}
          <div className="absolute -bottom-14 -right-14 size-[260px] pointer-events-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={105}
                  paddingAngle={6}
                  dataKey="units"
                  stroke="none"
                  cornerRadius={8}
                  shape={(props: SliceShapeProps) => {
                    const isHovered =
                      hoveredCategory === props.payload.categoryId || props.isActive;
                    return (
                      <Sector
                        cx={props.cx}
                        cy={props.cy}
                        innerRadius={props.innerRadius}
                        outerRadius={props.outerRadius + (isHovered ? 8 : 0)}
                        startAngle={props.startAngle}
                        endAngle={props.endAngle}
                        fill={props.fill}
                        cornerRadius={8}
                        className={cn(
                          "transition-all duration-300",
                          isHovered ? "drop-shadow-lg" : ""
                        )}
                      />
                    );
                  }}
                  onMouseEnter={(_, index) => setHoveredCategory(slices[index].categoryId)}
                  onMouseLeave={() => setHoveredCategory(null)}
                >
                  {slices.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color} 
                      className="cursor-pointer transition-opacity duration-300"
                      opacity={hoveredCategory && hoveredCategory !== entry.categoryId ? 0.3 : 1}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center Content inside the Donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[26px] font-bold tabular-nums text-surface-inverse-foreground leading-none drop-shadow-md">
                {formatNumber(activeCat ? activeCat.units : totalUnits)}
              </span>
              <span className="text-micro text-surface-inverse-foreground/80 uppercase mt-1.5 font-semibold text-center px-4 max-w-[130px] leading-tight">
                {activeCat ? activeCat.name : "Toplam Stok"}
              </span>
            </div>
          </div>
        </div>
      )}
    </PanelCard>
  );
}
