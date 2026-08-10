import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import type { WarehouseStockTotal } from "@/lib/mock/dashboard";
import { EmptyState } from "@/components/common/empty-state";
import { Warehouse } from "lucide-react";

export function WarehouseStockBars({ data }: { data: WarehouseStockTotal[] }) {
  const max = Math.max(...data.map((d) => d.units), 1);

  return (
    <Card className="shadow-soft border-border/70 gap-4 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-sm font-semibold text-foreground">Depo Bazında Stok</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3.5 px-5">
        {data.length === 0 ? (
          <EmptyState icon={Warehouse} title="Depo verisi yok" />
        ) : (
          data.map((w) => (
            <div key={w.warehouseId} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{w.name}</span>
                <span className="text-muted-foreground">{formatNumber(w.units)} adet</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-series-1"
                  style={{ width: `${Math.max((w.units / max) * 100, 3)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
