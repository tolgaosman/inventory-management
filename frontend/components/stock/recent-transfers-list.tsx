"use client";

import Link from "next/link";
import { History } from "lucide-react";
import { PanelCard } from "@/components/common/panel-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductImageThumbnail } from "@/components/common/product-image-thumbnail";
import { formatNumber, formatDateTime } from "@/lib/format";
import type { StockMovement, Product } from "@/lib/types";

interface WarehouseInfo {
  id: string;
  name: string;
}

export function RecentTransfersList({
  movements,
  products,
  warehouses,
  className,
}: {
  movements: StockMovement[];
  products: Product[];
  warehouses: WarehouseInfo[];
  className?: string;
}) {
  return (
    <PanelCard
      className={className}
      title={
        <span className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          Son Transferler
        </span>
      }
      bodyClassName="flex flex-col"
    >
      {movements.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground py-8">
          Henüz transfer bulunmuyor.
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/70 hover:bg-transparent">
                <TableHead className="px-2">Ürün Adı</TableHead>
                <TableHead className="px-2 text-center">Miktar / Rota</TableHead>
                <TableHead className="px-2 text-right">Tarih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((m) => {
                const product = products.find((p) => p.id === m.productId);
                const sourceName = warehouses.find((w) => w.id === m.warehouseId)?.name ?? "-";
                const targetName = warehouses.find((w) => w.id === m.targetWarehouseId)?.name ?? "-";
                return (
                  <TableRow key={m.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                    <TableCell className="px-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ProductImageThumbnail src={product?.imageUrl} alt={product?.name ?? ""} size="xs" />
                        <Link href={`/urunler/${m.productId}`} className="block truncate text-xs sm:text-sm font-semibold hover:underline text-foreground">
                          {product?.name ?? "Ürün"}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 text-center">
                      <div className="text-xs font-semibold tabular-nums text-primary">
                        {formatNumber(m.quantity)}
                      </div>
                      <div className="text-micro text-muted-foreground whitespace-nowrap">
                        {sourceName} → {targetName}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 text-right">
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
    </PanelCard>
  );
}
