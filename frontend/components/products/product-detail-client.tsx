"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Package, Boxes, Wallet, Warehouse as WarehouseIcon, History } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/error-state";
import { Can } from "@/components/common/can";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { StockStatusBadge, ProductStatusBadge } from "@/components/common/status-badge";
import { ProductFormSheet } from "@/components/products/product-form-sheet";
import { useAsync } from "@/lib/hooks/use-async";
import { getProduct, getProductHistory, getProductStockByWarehouse, updateProduct } from "@/lib/api/products";
import { listWarehouses, listCategories, listSuppliers } from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/client";
import { formatCurrency, formatDateTime, formatNumber, formatSigned } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/lib/currency-context";

function stockLevel(totalStock: number, minStock: number, critical: boolean): "kritik" | "dusuk" | "normal" {
  if (critical) return "kritik";
  if (totalStock < minStock * 1.5) return "dusuk";
  return "normal";
}

export function ProductDetailClient({ id }: { id: string }) {
  const [formOpen, setFormOpen] = useState(false);
  const { currency, rates } = useCurrency();

  const { status, data, staleData, error, refetch } = useAsync(
    () =>
      Promise.all([
        getProduct(id),
        getProductStockByWarehouse(id),
        getProductHistory(id),
        listWarehouses(),
        listCategories(),
        listSuppliers()
      ]),
    [id],
  );
  const view = data ?? staleData;

  async function handleSaved(values: Parameters<typeof updateProduct>[1]) {
    try {
      await updateProduct(id, values);
      refetch();
    } catch (err) {
      toast.error("Ürün güncellenemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
      throw err;
    }
  }

  if (status === "error" && !view) {
    return (
      <div className="space-y-6">
        <PageHeader title="Ürün Detayı" />
        <ErrorState message={error?.message} onRetry={refetch} />
      </div>
    );
  }

  if (!view) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-xl lg:col-span-1" />
          <Skeleton className="h-96 rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  const [product, stockByWarehouse, history, warehouses, categories, suppliersResult] = view;
  const suppliers = suppliersResult.rows;
  const level = stockLevel(product.totalStock, product.minStock, product.critical);
  const stockValue = product.totalStock * product.purchasePrice;

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: "Ürün Adı", value: product.name },
    { label: "SKU", value: <span className="font-mono">{product.sku}</span> },
    { label: "Barkod", value: <span className="font-mono">{product.barcode}</span> },
    { label: "Kategori", value: product.categoryName },
    { label: "Marka", value: product.brand },
    { label: "Birim", value: product.unit },
    { label: "Alış Fiyatı", value: formatCurrency(product.purchasePrice, currency, rates?.[currency] || 1) },
    { label: "Satış Fiyatı", value: formatCurrency(product.salePrice, currency, rates?.[currency] || 1) },
    { label: "Minimum Stok", value: formatNumber(product.minStock) },
    { label: "Maksimum Stok", value: formatNumber(product.maxStock) },
    { label: "Durum", value: <ProductStatusBadge status={product.status} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/urunler"
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Ürünlere dön
        </Link>
        <PageHeader
          title={product.name}
          description={`${product.sku} · ${product.categoryName}`}
          actions={
            <Can permission="products.manage">
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Pencil className="size-4" />
                Düzenle
              </Button>
            </Can>
          }
        />
      </div>

      <div className={status === "loading" ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="shadow-soft border-border/70 py-5 gap-2">
            <CardContent className="flex items-center gap-3 px-5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Boxes className="size-4.5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Toplam Stok</p>
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {formatNumber(product.totalStock)} <span className="text-xs font-normal text-muted-foreground">{product.unit}</span>
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft border-border/70 py-5 gap-2">
            <CardContent className="flex items-center justify-between px-5">
              <div>
                <p className="text-xs text-muted-foreground">Stok Durumu</p>
                <div className="mt-1">
                  <StockStatusBadge level={level} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft border-border/70 py-5 gap-2">
            <CardContent className="flex items-center gap-3 px-5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-status-good/10 text-status-good">
                <Wallet className="size-4.5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stok Değeri</p>
                <p className="text-lg font-bold tabular-nums text-foreground">{formatCurrency(stockValue, currency, rates?.[currency] || 1)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="shadow-soft border-border/70 py-5 gap-3 lg:col-span-1">
            <CardHeader className="px-5 pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight text-foreground">
                <Package className="size-4 text-muted-foreground" />
                Ürün Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pt-2">
              <dl className="divide-y divide-border/60">
                {fields.map((f) => (
                  <div key={f.label} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="font-medium text-foreground">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <div className="space-y-4 lg:col-span-2">
            <Card className="shadow-soft border-border/70 py-5 gap-3">
              <CardHeader className="px-5 pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight text-foreground">
                  <WarehouseIcon className="size-4 text-muted-foreground" />
                  Depo Bazında Stok
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-5 pt-2">
                {stockByWarehouse.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Bu ürün için depo kaydı yok.</p>
                ) : (
                  stockByWarehouse.map((s) => {
                    const warehouse = warehouses.find((w) => w.id === s.warehouseId);
                    const ratio = product.maxStock > 0 ? Math.min(100, (s.quantity / product.maxStock) * 100) : 0;
                    return (
                      <div key={s.warehouseId} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground">{warehouse?.name ?? "Bilinmeyen Depo"}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {formatNumber(s.quantity)} {product.unit}
                          </span>
                        </div>
                        <Progress value={ratio}>
                          <ProgressTrack>
                            <ProgressIndicator
                              className={cn(s.quantity < product.minStock && "bg-status-critical")}
                            />
                          </ProgressTrack>
                        </Progress>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="shadow-soft border-border/70 py-5 gap-3">
              <CardHeader className="px-5 pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight text-foreground">
                  <History className="size-4 text-muted-foreground" />
                  Hareket Geçmişi
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pt-2">
                {history.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Henüz stok hareketi yok.</p>
                ) : (
                  <div className="max-h-80 space-y-1 overflow-y-auto custom-scrollbar pr-1">
                    {history
                      .slice()
                      .sort((a, b) => (a.date < b.date ? 1 : -1))
                      .map((h) => (
                        <div
                          key={h.id}
                          className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted/50"
                        >
                          <div>
                            <p className="font-medium text-foreground">{h.label}</p>
                            <p className="text-xs text-muted-foreground">{formatDateTime(h.date)}</p>
                          </div>
                          <span
                            className={cn(
                              "tabular-nums font-semibold",
                              h.delta > 0 ? "text-status-good" : "text-status-critical",
                            )}
                          >
                            {formatSigned(h.delta)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <ProductFormSheet open={formOpen} onOpenChange={setFormOpen} product={product} onSaved={handleSaved} categories={categories} suppliers={suppliers} />
    </div>
  );
}
