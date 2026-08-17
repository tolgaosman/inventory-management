"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { ProductImageThumbnail } from "@/components/common/product-image-thumbnail";
import { formatNumber, formatDateTime } from "@/lib/format";
import type { StockMovement } from "@/lib/types";

interface ProductInfo {
  id: string;
  name: string;
  sku: string;
  imageUrl?: string;
}

interface WarehouseInfo {
  id: string;
  name: string;
}

interface UserInfo {
  id: string;
  name: string;
}

export function TransferHistoryTable({
  movements,
  total,
  page,
  pageSize,
  onPageChange,
  loading,
  products,
  warehouses,
  users,
}: {
  movements: StockMovement[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading: boolean;
  products: ProductInfo[];
  warehouses: WarehouseInfo[];
  users: UserInfo[];
}) {
  const columns = useMemo<ColumnDef<StockMovement, unknown>[]>(
    () => [
      {
        id: "product",
        header: "Ürün",
        meta: { className: "w-[32%] text-left" },
        cell: ({ row }) => {
          const product = products.find((p) => p.id === row.original.productId);
          return (
            <Link
              href={`/urunler/${row.original.productId}`}
              className="flex items-center gap-3 group hover:text-primary"
            >
              <ProductImageThumbnail src={product?.imageUrl} alt={product?.name ?? ""} size="sm" />
              <div className="min-w-0">
                <span className="block truncate font-medium text-foreground group-hover:text-primary transition-colors">
                  {product?.name ?? "Bilinmeyen ürün"}
                </span>
                <span className="block font-mono text-xs text-muted-foreground">{product?.sku}</span>
              </div>
            </Link>
          );
        },
      },
      {
        id: "route",
        header: "Kaynak → Hedef",
        meta: { className: "w-[30%] text-center" },
        cell: ({ row }) => {
          const source = warehouses.find((w) => w.id === row.original.warehouseId)?.name ?? "-";
          const target = warehouses.find((w) => w.id === row.original.targetWarehouseId)?.name ?? "-";
          return (
            <span className="block truncate" title={`${source} → ${target}`}>
              {source} <span className="text-muted-foreground">→</span> {target}
            </span>
          );
        },
      },
      {
        id: "quantity",
        header: "Miktar",
        meta: { className: "w-[11%] whitespace-nowrap px-4 text-center" },
        cell: ({ row }) => (
          <span className="font-medium tabular-nums text-primary flex justify-center">{formatNumber(row.original.quantity)}</span>
        ),
      },
      {
        id: "user",
        header: "Kullanıcı",
        meta: { className: "w-[15%] text-center" },
        cell: ({ row }) => {
          const userName = users.find((u) => u.id === row.original.userId)?.name ?? "-";
          return <span className="block truncate" title={userName}>{userName}</span>;
        },
      },
      {
        id: "createdAt",
        header: "Tarih",
        meta: { className: "w-[12%] whitespace-nowrap px-4 text-center" },
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [products, warehouses, users],
  );

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold tracking-tight text-foreground">Son Transferler</h2>
      <DataTable
        columns={columns}
        data={movements}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={onPageChange}
        loading={loading}
        emptyTitle="Henüz transfer yok"
      />
    </section>
  );
}
