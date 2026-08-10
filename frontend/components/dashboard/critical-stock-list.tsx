import Link from "next/link";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { Can } from "@/components/common/can";
import type { Product } from "@/lib/types";

export function CriticalStockList({ items }: { items: (Product & { totalStock: number })[] }) {
  return (
    <Card className="shadow-soft border-border/70 gap-4 py-5">
      <CardHeader className="flex-row items-center justify-between px-5">
        <CardTitle className="text-sm font-semibold text-foreground">Kritik Stok Uyarıları</CardTitle>
        <Link href="/urunler?stockStatus=kritik" className="text-xs font-medium text-primary hover:underline">
          Tümünü gör
        </Link>
      </CardHeader>
      <CardContent className="space-y-1 px-5">
        {items.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Kritik stok yok" description="Tüm ürünler minimum seviyenin üzerinde." />
        ) : (
          items.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg px-1 py-2 hover:bg-muted/50">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-status-critical/10 text-status-critical">
                <AlertTriangle className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/urunler/${p.id}`} className="block truncate text-sm font-medium hover:underline">
                  {p.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  Mevcut: {p.totalStock} · Minimum: {p.minStock}
                </p>
              </div>
              <Can permission="purchase.manage">
                <Button
                  render={<Link href={`/satin-alma?productId=${p.id}`} />}
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                >
                  Satın alma oluştur
                </Button>
              </Can>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
