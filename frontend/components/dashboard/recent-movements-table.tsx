import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MovementTypeBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { History } from "lucide-react";
import { relativeTimeFromNow } from "@/lib/format";
import type { StockMovement } from "@/lib/types";
import { products, users, warehouses } from "@/lib/mock/data";

export function RecentMovementsTable({ items }: { items: StockMovement[] }) {
  return (
    <Card className="flex flex-col justify-between py-5 min-h-[360px]">
      <CardHeader className="flex-row items-center justify-between px-5 pb-2">
        <CardTitle className="text-base font-semibold tracking-tight text-foreground">Son Stok Hareketleri</CardTitle>
        <Link href="/stok/hareketler" className="text-xs font-medium text-primary hover:underline">
          Tümünü gör
        </Link>
      </CardHeader>
      <CardContent className="px-5 flex-1 min-h-0">
        {items.length === 0 ? (
          <EmptyState icon={History} title="Henüz stok hareketi yok" />
        ) : (
          <div className="max-h-[340px] overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/70 hover:bg-transparent">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">İşlem Tipi</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ürün & Detay</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Zaman</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((m) => {
                  const product = products.find((p) => p.id === m.productId);
                  const warehouse = warehouses.find((w) => w.id === m.warehouseId);
                  const user = users.find((u) => u.id === m.userId);
                  return (
                    <TableRow key={m.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <TableCell className="py-2.5 px-2">
                        <MovementTypeBadge type={m.type} />
                      </TableCell>
                      <TableCell className="py-2.5 px-2 min-w-0">
                        <Link href={`/urunler/${m.productId}`} className="block truncate text-xs sm:text-sm font-semibold hover:underline text-foreground">
                          {product?.name ?? "Bilinmeyen ürün"}
                        </Link>
                        <p className="truncate text-micro text-muted-foreground">
                          {warehouse?.name} · {user?.name}
                        </p>
                      </TableCell>
                      <TableCell className="text-right py-2.5 px-2">
                        <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                          {relativeTimeFromNow(m.createdAt)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

