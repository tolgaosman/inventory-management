import { TrendingUp, Wallet, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface PurchaseHeroData {
  cancelledOrders: number;
  pendingDeliveries: number;
  openPurchaseOrders: number;
  totalPurchaseOrders: number;
  purchaseTotalValueLabel: string;
}

const BAR_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

export function PurchaseHeroCard({ data }: { data: PurchaseHeroData }) {
  const bars = [
    { key: "cancelledOrders", label: "İptal", color: BAR_COLORS[0] },
    { key: "pendingDeliveries", label: "Bekleyen", color: BAR_COLORS[1] },
    { key: "openPurchaseOrders", label: "Açık", color: BAR_COLORS[2] },
    { key: "totalPurchaseOrders", label: "Toplam", color: BAR_COLORS[3] },
  ] as const;

  const maxValue = Math.max(...bars.map((b) => data[b.key]), 1);

  return (
    <Card className="flex h-full flex-col justify-between overflow-hidden border border-border/50 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-foreground">Satın Alma Özeti</h3>
          <p className="text-xs text-muted-foreground">Aktif sipariş ve teslimat durumu</p>
        </div>
        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <TrendingUp className="size-4" />
        </div>
      </div>

      <div className="mt-6 flex flex-1 items-end gap-2 h-[140px] px-2">
        {bars.map((b, i) => {
          const heightPercent = Math.max((data[b.key] / maxValue) * 100, 8);
          return (
            <div key={b.key} className="group relative flex flex-1 flex-col items-center justify-end h-full">
              {/* Tooltip-like value display on hover */}
              <div className="absolute -top-6 opacity-0 transition-opacity duration-200 group-hover:opacity-100 flex flex-col items-center">
                <span className="rounded bg-popover px-2 py-0.5 text-xs font-bold text-popover-foreground shadow-sm">
                  {data[b.key]}
                </span>
              </div>
              
              {/* Bar Track */}
              <div className="relative w-full max-w-[40px] h-[100px] rounded-full bg-secondary/40 overflow-hidden">
                {/* Actual Bar Fill */}
                <div 
                  className="absolute bottom-0 left-0 w-full rounded-full transition-all duration-700 ease-out"
                  style={{ 
                    height: `${heightPercent}%`,
                    backgroundColor: b.color,
                    boxShadow: `0 0 12px ${b.color}40` // Subtle glow
                  }}
                />
              </div>

              {/* Label */}
              <span className="mt-3 text-[11px] font-medium text-muted-foreground">
                {b.label}
              </span>
              <span className="mt-0.5 text-sm font-bold text-foreground tabular-nums">
                {data[b.key]}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-border/50 pt-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex size-6 items-center justify-center rounded-md bg-muted">
            <Wallet className="size-3.5" />
          </div>
          Toplam Tutar
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-base font-bold tabular-nums text-foreground">{data.purchaseTotalValueLabel}</span>
          <ArrowUpRight className="size-4 text-emerald-500" />
        </div>
      </div>
    </Card>
  );
}
