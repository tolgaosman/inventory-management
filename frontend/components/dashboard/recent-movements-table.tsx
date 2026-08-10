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
    <Card className="shadow-soft border-border/70 gap-4 py-5">
      <CardHeader className="flex-row items-center justify-between px-5">
        <CardTitle className="text-sm font-semibold text-foreground">Son Stok Hareketleri</CardTitle>
        <Link href="/stok/hareketler" className="text-xs font-medium text-primary hover:underline">
          Tümünü gör
        </Link>
      </CardHeader>
      <CardContent className="px-5">
        {items.length === 0 ? (
          <EmptyState icon={History} title="Henüz stok hareketi yok" />
        ) : (
          <div className="space-y-1">
            {items.map((m) => {
              const product = products.find((p) => p.id === m.productId);
              const warehouse = warehouses.find((w) => w.id === m.warehouseId);
              const user = users.find((u) => u.id === m.userId);
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-lg px-1 py-2 hover:bg-muted/50">
                  <MovementTypeBadge type={m.type} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/urunler/${m.productId}`} className="block truncate text-sm font-medium hover:underline">
                      {product?.name ?? "Bilinmeyen ürün"}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {warehouse?.name} · {user?.name}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{relativeTimeFromNow(m.createdAt)}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
