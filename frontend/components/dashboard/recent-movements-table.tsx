import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MovementTypeBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { History } from "lucide-react";
import { relativeTimeFromNow } from "@/lib/format";
import type { StockMovement } from "@/lib/types";
import { products, users, warehouses } from "@/lib/mock/data";

export function RecentMovementsTable({ items }: { items: StockMovement[] }) {
  return (
    <Card className="shadow-soft border-border/70 flex flex-col justify-between py-5 min-h-[360px]">
      <CardHeader className="flex-row items-center justify-between px-5 pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">Son Stok Hareketleri</CardTitle>
        <Link href="/stok/hareketler" className="text-xs font-medium text-primary hover:underline">
          Tümünü gör
        </Link>
      </CardHeader>
      <CardContent className="px-5 flex-1 min-h-0">
        {items.length === 0 ? (
          <EmptyState icon={History} title="Henüz stok hareketi yok" />
        ) : (
          <div className="max-h-[340px] overflow-y-auto custom-scrollbar space-y-2 pr-1.5">
            {items.map((m) => {
              const product = products.find((p) => p.id === m.productId);
              const warehouse = warehouses.find((w) => w.id === m.warehouseId);
              const user = users.find((u) => u.id === m.userId);
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-muted/50 transition-colors border border-transparent hover:border-border/40">
                  <MovementTypeBadge type={m.type} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/urunler/${m.productId}`} className="block truncate text-xs sm:text-sm font-semibold hover:underline text-foreground">
                      {product?.name ?? "Bilinmeyen ürün"}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {warehouse?.name} · {user?.name}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground font-medium">{relativeTimeFromNow(m.createdAt)}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
