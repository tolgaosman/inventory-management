"use client";

import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";
import { MapPin, Warehouse } from "lucide-react";
import { PanelCard } from "@/components/common/panel-card";
import { EmptyState } from "@/components/common/empty-state";
import { capacityFillVar } from "@/lib/capacity";
import { formatNumber, formatCurrency } from "@/lib/format";
import type { WarehouseDetail } from "@/lib/mock/dashboard";

/**
 * Depo karşılaştırması: her depo için tek bir doluluk halkası. Önceki sürüm
 * "Etiket: değer" satırlarından oluşan bir kart grid'iydi — burada tek ölçü
 * (doluluk yüzdesi) doğrudan halka olarak okunuyor, geri kalan metrikler
 * (adet, SKU, değer) halkanın altında destekleyici mikro metin.
 */
export function WarehouseCapacityRadials({
  data,
  currency,
  rate,
}: {
  data: WarehouseDetail[];
  currency: string;
  rate: number;
}) {
  return (
    <PanelCard title="Depo Karşılaştırması" meta={`${data.length} depo`}>
      {data.length === 0 ? (
        <EmptyState icon={Warehouse} title="Depo verisi yok" />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((w) => (
            <div key={w.warehouseId} className="flex flex-col items-center rounded-lg border border-border/70 bg-card p-3 text-center">
              <div className="relative size-28">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    data={[{ value: w.capacityPercent }]}
                    startAngle={90}
                    endAngle={-270}
                    innerRadius="76%"
                    outerRadius="100%"
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
                    <RadialBar
                      dataKey="value"
                      cornerRadius={999}
                      background={{ fill: "var(--muted)" }}
                      fill={capacityFillVar(w.capacityPercent)}
                      animationDuration={600}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-bold tabular-nums text-foreground">%{w.capacityPercent}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground leading-none mt-1">
                    {formatNumber(w.units)}/{formatNumber(w.capacity)}
                  </span>
                </div>
              </div>

              <div className="mt-2 min-w-0 space-y-0.5">
                <p className="truncate text-sm font-semibold text-foreground">{w.name}</p>
                <p className="flex items-center justify-center gap-1 text-micro uppercase text-muted-foreground">
                  <MapPin className="size-3 shrink-0" />
                  {w.city}
                </p>
                <p className="text-micro text-muted-foreground">
                  {formatNumber(w.units)} adet · {w.productCount} SKU · {formatCurrency(w.totalValue / rate, currency, 1, true)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}
