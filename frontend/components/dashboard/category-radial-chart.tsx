import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { CategoryShare } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, Sector, ResponsiveContainer } from "recharts";

// Vibrant pastel blue/green/turquoise palette that pops against the dark background
const SLICE_COLORS = [
  "#ffffff", // Crisp White for the largest slice
  "#7dd3fc", // Light Sky Blue
  "#67e8f9", // Light Cyan/Turquoise
  "#6ee7b7", // Light Emerald/Green
];

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        cornerRadius={8}
        className="drop-shadow-lg transition-all duration-300"
      />
    </g>
  );
};

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
    <Card className="relative flex h-full flex-col overflow-hidden border-0 bg-sidebar-primary p-5 text-white shadow-lg">
      <div className="relative z-10 flex items-center justify-between">
        <span className="text-xl font-medium text-white">Stok Dağılımı</span>
        <div className="flex size-8 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
          <SlidersHorizontal className="size-4 text-white/90" />
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="relative z-10 flex flex-1 items-center justify-center py-10 text-center text-sm text-white/75">
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
                  <span className="text-[13px] font-medium leading-snug text-white/90 truncate">
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
                  activeIndex={hoveredCategory ? slices.findIndex(s => s.categoryId === hoveredCategory) : -1}
                  activeShape={renderActiveShape}
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
              <span className="text-[26px] font-bold tabular-nums text-white leading-none drop-shadow-md">
                {formatNumber(activeCat ? activeCat.units : totalUnits)}
              </span>
              <span className="text-[10px] text-white/80 uppercase mt-1.5 font-semibold text-center px-4 max-w-[130px] leading-tight">
                {activeCat ? activeCat.name : "Toplam Stok"}
              </span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
