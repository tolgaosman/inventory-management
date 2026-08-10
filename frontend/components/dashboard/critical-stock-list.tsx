import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { Can } from "@/components/common/can";
import type { Product } from "@/lib/types";

export function CriticalStockList({ items }: { items: (Product & { totalStock: number })[] }) {
  return (
    <Card className="shadow-soft border-border/70 flex flex-col justify-between py-5 min-h-[360px]">
      <CardHeader className="flex-row items-center justify-between px-5 pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">Kritik Stok Uyarıları</CardTitle>
        <Link href="/urunler?stockStatus=kritik" className="text-xs font-medium text-primary hover:underline">
          Tümünü gör
        </Link>
      </CardHeader>
      <CardContent className="px-5 flex-1 min-h-0">
        {items.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Kritik stok yok" description="Tüm ürünler minimum seviyenin üzerinde." />
        ) : (
          <div className="max-h-[340px] overflow-y-auto custom-scrollbar space-y-2 pr-1.5">
            {items.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-muted/50 transition-colors border border-transparent hover:border-border/40">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-status-critical/10 text-status-critical">
                  <AlertTriangle className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/urunler/${p.id}`} className="block truncate text-xs sm:text-sm font-semibold hover:underline text-foreground">
                    {p.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Mevcut: <span className="font-bold text-status-critical">{p.totalStock}</span> · Min: {p.minStock}
                  </p>
                </div>
                <Can permission="purchase.manage">
                  <Button
                    render={<Link href={`/satin-alma?productId=${p.id}`} />}
                    nativeButton={false}
                    size="sm"
                    variant="outline"
                    className="shrink-0 text-xs h-8"
                    onClick={() => {
                      toast.info("Satın Alma Talebi Başlatıldı", {
                        description: `${p.name} için tedarik siparişi hazırlanıyor.`,
                        icon: "🛒",
                      });
                    }}
                  >
                    Satın alma
                  </Button>
                </Can>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
