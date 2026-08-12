import Link from "next/link";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { Can } from "@/components/common/can";
import type { Product } from "@/lib/types";

import { ProductImageThumbnail } from "@/components/common/product-image-thumbnail";

export function CriticalStockList({ items }: { items: (Product & { totalStock: number })[] }) {
  return (
    <Card className="flex flex-col justify-between py-5 min-h-[360px]">
      <CardHeader className="flex-row items-center justify-between px-5 pb-2">
        <CardTitle className="text-base font-semibold tracking-tight text-foreground">Kritik Stok Uyarıları</CardTitle>
        <Link href="/urunler?stockStatus=kritik" className="text-xs font-medium text-primary hover:underline">
          Tümünü gör
        </Link>
      </CardHeader>
      <CardContent className="px-5 flex-1 min-h-0">
        {items.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Kritik stok yok" description="Tüm ürünler minimum seviyenin üzerinde." />
        ) : (
          <div className="max-h-[340px] overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/70 hover:bg-transparent">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ürün Adı</TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mevcut / Min</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                    <TableCell className="py-2.5 px-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ProductImageThumbnail src={p.imageUrl} alt={p.name} size="xs" />
                        <Link href={`/urunler/${p.id}`} className="block truncate text-xs sm:text-sm font-semibold hover:underline text-foreground">
                          {p.name}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-2.5 px-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        <span className="font-semibold text-status-critical">{p.totalStock}</span> / {p.minStock}
                      </span>
                    </TableCell>
                    <TableCell className="text-right py-2.5 px-2">
                      <Can permission="purchase.manage">
                        <Button
                          render={<Link href={`/satin-alma?productId=${p.id}`} />}
                          nativeButton={false}
                          size="sm"
                          variant="outline"
                          className="shrink-0 text-xs h-7 px-2.5"
                          onClick={() => {
                            toast.info("Satın Alma Talebi Başlatıldı", {
                              description: `${p.name} için tedarik siparişi hazırlanıyor.`,
                            });
                          }}
                        >
                          Satın alma
                        </Button>
                      </Can>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

