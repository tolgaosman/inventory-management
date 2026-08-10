import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { TrendingUp } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { TopMover } from "@/lib/mock/dashboard";

export function TopMoversList({ items }: { items: TopMover[] }) {
  const max = Math.max(...items.map((i) => i.totalQuantity), 1);

  return (
    <Card className="shadow-soft border-border/70 flex flex-col justify-between py-5 min-h-[360px]">
      <CardHeader className="px-5 pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">En Çok Hareket Gören Ürünler</CardTitle>
      </CardHeader>
      <CardContent className="px-5 flex-1 min-h-0">
        {items.length === 0 ? (
          <EmptyState icon={TrendingUp} title="Hareket verisi yok" />
        ) : (
          <div className="max-h-[340px] overflow-y-auto custom-scrollbar space-y-3 pr-1.5">
            {items.map((item, i) => (
              <Link
                key={item.productId}
                href={`/urunler/${item.productId}`}
                className="flex items-center gap-3 rounded-xl p-2 hover:bg-muted/50 transition-colors border border-transparent hover:border-border/40 group"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs sm:text-sm font-semibold text-foreground">{item.name}</p>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${Math.max((item.totalQuantity / max) * 100, 4)}%` }}
                    />
                  </div>
                </div>
                <span className="shrink-0 text-xs font-bold text-slate-700 dark:text-slate-300 ml-2">{formatNumber(item.totalQuantity)}</span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
