"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { ProductImageThumbnail } from "@/components/common/product-image-thumbnail";
import { formatNumber, formatDateTime } from "@/lib/format";
import { MOVEMENT_REASON_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
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

interface SupplierInfo {
  id: string;
  name: string;
}

interface UserInfo {
  id: string;
  name: string;
}

export function RecentMovementsCard({
  mode,
  movements,
  total,
  page,
  pageSize,
  onPageChange,
  loading,
  products,
  warehouses,
  suppliers,
  users,
}: {
  mode: "giris" | "cikis";
  movements: StockMovement[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading: boolean;
  products: ProductInfo[];
  warehouses: WarehouseInfo[];
  suppliers: SupplierInfo[];
  users: UserInfo[];
}) {
  const columns = useMemo<ColumnDef<StockMovement, unknown>[]>(
    () => [
      {
        id: "product",
        header: "Ürün",
        meta: { className: "w-[30%] text-left" },
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
        id: "warehouse",
        header: "Depo",
        meta: { className: "w-[18%] text-left" },
        cell: ({ row }) => {
          const name = warehouses.find((w) => w.id === row.original.warehouseId)?.name ?? "-";
          return <span className="block truncate" title={name}>{name}</span>;
        },
      },
      {
        id: "quantity",
        header: "Miktar",
        meta: { className: "w-[11%] whitespace-nowrap text-right" },
        cell: ({ row }) => (
          <span
            className={cn(
              "font-medium tabular-nums",
              mode === "giris" ? "text-status-good" : "text-status-critical",
            )}
          >
            {mode === "giris" ? "+" : "-"}
            {formatNumber(row.original.quantity)}
          </span>
        ),
      },
      {
        id: "reason",
        header: mode === "giris" ? "Tedarikçi" : "Sebep",
        meta: { className: "w-[18%] text-left" },
        cell: ({ row }) => {
          const label =
            mode === "giris"
              ? suppliers.find((s) => s.id === row.original.supplierId)?.name ?? "-"
              : MOVEMENT_REASON_LABELS[row.original.reason];
          return <span className="block truncate" title={label}>{label}</span>;
        },
      },
      {
        id: "user",
        header: "Kullanıcı",
        meta: { className: "w-[13%] text-left" },
        cell: ({ row }) => {
          const userName = row.original.userName ?? "-";
          return <span className="block truncate" title={userName}>{userName}</span>;
        },
      },
      {
        id: "createdAt",
        header: "Tarih",
        meta: { className: "w-[10%] whitespace-nowrap text-right" },
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [mode, products, warehouses, suppliers, users],
  );

  return (
    // No Card wrapper: DataTable already declares its own bordered surface, and
    // the design language forbids nesting a card in a card. A plain heading over
    // the table gives the same reading order without the second box.
    <section className="space-y-3">
      <h2 className="text-base font-semibold tracking-tight text-foreground">
        Son {mode === "giris" ? "Girişler" : "Çıkışlar"}
      </h2>
      <DataTable
        columns={columns}
        data={movements}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={onPageChange}
        loading={loading}
        emptyTitle={mode === "giris" ? "Henüz stok girişi yok" : "Henüz stok çıkışı yok"}
      />
    </section>
  );
}
