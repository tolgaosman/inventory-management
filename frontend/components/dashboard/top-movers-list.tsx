import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { TrendingUp } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { TopMover } from "@/lib/mock/dashboard";

export function TopMoversList({ items }: { items: TopMover[] }) {
  const max = Math.max(...items.map((i) => i.totalQuantity), 1);

  return (
    <Card className="shadow-soft border-border/70 gap-4 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-sm font-semibold text-foreground">En Çok Hareket Gören Ürünler</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-5">
        {items.length === 0 ? (
          <EmptyState icon={TrendingUp} title="Hareket verisi yok" />
        ) : (
          items.map((item, i) => (
            <Link
              key={item.productId}
              href={`/urunler/${item.productId}`}
              className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-muted/50"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-series-3"
                    style={{ width: `${Math.max((item.totalQuantity / max) * 100, 4)}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{formatNumber(item.totalQuantity)}</span>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
