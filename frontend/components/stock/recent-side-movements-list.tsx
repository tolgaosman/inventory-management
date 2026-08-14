"use client";

import Link from "next/link";
import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductImageThumbnail } from "@/components/common/product-image-thumbnail";
import { formatNumber, formatDateTime } from "@/lib/format";
import { MOVEMENT_REASON_LABELS } from "@/lib/constants";
import type { StockMovement, Product } from "@/lib/types";

export function RecentSideMovementsList({
  movements,
  products,
}: {
  movements: StockMovement[];
  products: Product[];
}) {
  return (
    <Card className="py-5 gap-3 flex flex-col justify-between h-full">
      <CardHeader className="flex-row items-center justify-between px-5 pb-2 shrink-0">
        <CardTitle className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          Son Stok Çıkışları
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-2 flex-1 min-h-0 flex flex-col">
        {movements.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground py-8">
            Henüz stok çıkışı bulunmuyor.
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/70 hover:bg-transparent">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ürün Adı</TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Miktar / Sebep</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tarih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => {
                  const product = products.find((p) => p.id === m.productId);
                  return (
                    <TableRow key={m.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <TableCell className="py-2.5 px-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ProductImageThumbnail src={product?.imageUrl} alt={product?.name ?? ""} size="xs" />
                          <Link href={`/urunler/${m.productId}`} className="block truncate text-xs sm:text-sm font-semibold hover:underline text-foreground">
                            {product?.name ?? "Ürün"}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-2.5 px-2">
                        <div className="text-xs font-semibold text-status-critical">
                          -{formatNumber(m.quantity)}
                        </div>
                        <div className="text-micro text-muted-foreground">
                          {MOVEMENT_REASON_LABELS[m.reason]}
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-2.5 px-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(m.createdAt)}
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
