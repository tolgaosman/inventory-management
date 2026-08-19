"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Package,
  Boxes,
  Wallet,
  Warehouse as WarehouseIcon,
  History,
  Truck,
  ChevronDown,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  ZoomIn,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/error-state";
import { Can } from "@/components/common/can";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  StockStatusBadge,
  ProductStatusBadge,
  MovementTypeBadge,
  PurchaseStatusBadge,
} from "@/components/common/status-badge";
import { ProductImageThumbnail } from "@/components/common/product-image-thumbnail";
import { ProductFormSheet } from "@/components/products/product-form-sheet";
import { StockMovementSheet, type StockMovementMode } from "@/components/products/stock-movement-sheet";
import { useAuth } from "@/lib/auth";
import { useAsync } from "@/lib/hooks/use-async";
import { getProduct, getProductHistory, getProductStockByWarehouse, updateProduct } from "@/lib/api/products";
import { listWarehouses, listCategories, listSuppliers } from "@/lib/api/catalog";
import { listPurchaseOrders } from "@/lib/api/purchase-orders";
import { ApiError } from "@/lib/api/client";
import { formatCurrency, formatDateShort, formatDateTime, formatNumber, formatSigned } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/lib/currency-context";
import { useSettings } from "@/lib/settings-context";

function stockLevel(totalStock: number, minStock: number, critical: boolean): "kritik" | "dusuk" | "normal" {
  if (critical) return "kritik";
  if (totalStock < minStock * 1.5) return "dusuk";
  return "normal";
}

export function ProductDetailClient({ id }: { id: string }) {
  const [formOpen, setFormOpen] = useState(false);
  const [movementMode, setMovementMode] = useState<StockMovementMode | null>(null);
  const [imageLightBoxOpen, setImageLightBoxOpen] = useState(false);
  const { currency, rates } = useCurrency();
  const { showKurus } = useSettings();
  const { can } = useAuth();

  const { status, data, staleData, error, refetch } = useAsync(
    () =>
      Promise.all([
        getProduct(id),
        getProductStockByWarehouse(id),
        getProductHistory(id),
        listWarehouses(),
        listCategories(),
        listSuppliers({ pageSize: 1000 }),
        listPurchaseOrders({ pageSize: 1000 }),
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

  const [product, stockByWarehouse, history, warehouses, categories, suppliersResult, purchaseOrdersResult] = view;
  const suppliers = suppliersResult.rows;
  const supplierName = suppliers.find((s) => s.id === product.supplierId)?.name ?? "-";
  const level = stockLevel(product.totalStock, product.minStock, product.critical);
  const stockValue = product.totalStock * product.purchasePrice;

  const openOrders = purchaseOrdersResult.rows
    .filter((po) => po.status === "ordered" || po.status === "partially_received")
    .flatMap((po) => {
      const item = po.items.find((i) => i.productId === product.id);
      const pending = item ? item.quantity - item.receivedQuantity : 0;
      return item && pending > 0 ? [{ po, pending }] : [];
    });
  const totalPending = openOrders.reduce((sum, o) => sum + o.pending, 0);

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: "Ürün Adı", value: product.name },
    { label: "SKU", value: <span className="font-mono">{product.sku}</span> },
    { label: "Barkod", value: <span className="font-mono">{product.barcode}</span> },
    { label: "Kategori", value: product.categoryName },
    { label: "Marka", value: product.brand },
    { label: "Birim", value: product.unit },
    { label: "Tedarikçi", value: supplierName },
    ...(can("financial.view") ? [
      { label: "Alış Fiyatı", value: formatCurrency(product.purchasePrice, currency, rates?.[currency] || 1, showKurus) },
      { label: "Satış Fiyatı", value: formatCurrency(product.salePrice, currency, rates?.[currency] || 1, showKurus) },
    ] : []),
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
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setImageLightBoxOpen(true)}
            className="group relative shrink-0 cursor-zoom-in rounded-2xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/50 transition-transform"
            title="Görseli büyütmek için tıklayın"
          >
            <ProductImageThumbnail src={product.imageUrl} alt={product.name} size="xl" className="shadow-sm transition-transform duration-200" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-[1px]">
              <ZoomIn className="size-6" />
            </div>
          </button>
          <div className="min-w-0 flex-1">
            <PageHeader
              title={product.name}
              description={`${product.sku} · ${product.categoryName}`}
              actions={
            <>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm">
                      Stok İşlemi
                      <ChevronDown className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <Can permission="stock.in">
                    <DropdownMenuItem
                      disabled={product.status === "pasif"}
                      onClick={() => setMovementMode("giris")}
                    >
                      <ArrowDownToLine className="size-4" />
                      Stok Girişi
                    </DropdownMenuItem>
                  </Can>
                  <Can permission="stock.out">
                    <DropdownMenuItem
                      disabled={product.status === "pasif"}
                      onClick={() => setMovementMode("cikis")}
                    >
                      <ArrowUpFromLine className="size-4" />
                      Stok Çıkışı
                    </DropdownMenuItem>
                  </Can>
                  <Can permission="stock.transfer">
                    <DropdownMenuItem
                      disabled={product.status === "pasif"}
                      onClick={() => setMovementMode("transfer")}
                    >
                      <ArrowLeftRight className="size-4" />
                      Depolar Arası Transfer
                    </DropdownMenuItem>
                  </Can>
                </DropdownMenuContent>
              </DropdownMenu>
              <Can permission="products.manage">
                <Button size="sm" onClick={() => setFormOpen(true)}>
                  <Pencil className="size-4" />
                  Düzenle
                </Button>
              </Can>
            </>
          }
        />
          </div>
        </div>
      </div>

      <div className={status === "loading" ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="py-5 gap-2">
            <CardContent className="flex items-center gap-3 px-5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Boxes className="size-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Toplam Stok</p>
                <p className="truncate text-lg font-semibold tabular-nums text-foreground">
                  {formatNumber(product.totalStock)} <span className="text-xs font-normal text-muted-foreground">{product.unit}</span>
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-5 gap-2">
            <CardContent className="flex items-center justify-between px-5">
              <div>
                <p className="text-xs text-muted-foreground">Stok Durumu</p>
                <div className="mt-1">
                  <StockStatusBadge level={level} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Can permission="financial.view">
            <Card className="py-5 gap-2">
              <CardContent className="flex items-center gap-3 px-5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-status-good/10 text-status-good">
                  <Wallet className="size-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Stok Değeri</p>
                  <p className="truncate text-lg font-semibold tabular-nums text-foreground">{formatCurrency(stockValue, currency, rates?.[currency] || 1, showKurus)}</p>
                </div>
              </CardContent>
            </Card>
          </Can>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="py-5 gap-3 lg:col-span-1">
            <CardHeader className="px-5 pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
                <Package className="size-4 text-muted-foreground" />
                Ürün Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pt-2">
              <dl className="divide-y divide-border/60">
                {fields.map((f) => (
                  <div key={f.label} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <dt className="shrink-0 text-muted-foreground">{f.label}</dt>
                    <dd className="min-w-0 truncate text-right font-medium text-foreground" title={typeof f.value === "string" ? f.value : undefined}>
                      {f.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <div className="space-y-4 lg:col-span-2">
            <Card className="py-5 gap-3">
              <CardHeader className="px-5 pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
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
                              className={cn(
                                s.quantity < product.minStock
                                  ? "bg-tint-red"
                                  : s.quantity < product.minStock * 1.5
                                    ? "bg-tint-amber"
                                    : "bg-tint-green",
                              )}
                            />
                          </ProgressTrack>
                        </Progress>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="py-5 gap-3">
              <CardHeader className="px-5 pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
                  <Truck className="size-4 text-muted-foreground" />
                  Açık Siparişler
                  {openOrders.length > 0 && (
                    <span className="ml-auto text-xs font-medium text-muted-foreground">
                      {openOrders.length} sipariş · {formatNumber(totalPending)} {product.unit} yolda
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-5 pt-2">
                {openOrders.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">Bu ürün için açık sipariş yok.</p>
                ) : (
                  openOrders.map(({ po, pending }) => (
                    <div
                      key={po.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{po.code}</p>
                        <p className="text-xs text-muted-foreground">
                          {po.supplierName} · Beklenen: {formatDateShort(po.expectedAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {formatNumber(pending)} {product.unit}
                        </span>
                        <PurchaseStatusBadge status={po.status} />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="py-5 gap-3">
              <CardHeader className="px-5 pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
                  <History className="size-4 text-muted-foreground" />
                  Hareket Geçmişi
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pt-2">
                {history.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Henüz stok hareketi yok.</p>
                ) : (
                  <div className="max-h-96 space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
                    {history
                      .slice()
                      .sort((a, b) => (a.date < b.date ? 1 : -1))
                      .map((h) => (
                        <div
                          key={h.id}
                          className="rounded-lg px-2 py-2 text-sm hover:bg-muted/50"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <MovementTypeBadge type={h.type} />
                              <span className="text-xs text-muted-foreground">
                                {h.warehouseName}
                                {h.targetWarehouseName ? ` → ${h.targetWarehouseName}` : ""} · {h.reasonLabel}
                              </span>
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
                          <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span>
                              {h.userName} · {formatDateTime(h.date)}
                            </span>
                            <span className="tabular-nums">
                              {formatNumber(h.previousQuantity)} → {formatNumber(h.newQuantity)}
                            </span>
                          </div>
                          {h.note && (
                            <p className="mt-1 text-xs text-muted-foreground italic">&ldquo;{h.note}&rdquo;</p>
                          )}
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

      <StockMovementSheet
        open={movementMode != null}
        onOpenChange={(open) => !open && setMovementMode(null)}
        product={product}
        mode={movementMode ?? "giris"}
        warehouses={warehouses}
        suppliers={suppliers}
        onDone={refetch}
      />

      <Dialog open={imageLightBoxOpen} onOpenChange={setImageLightBoxOpen}>
        {/* An image viewer stays dark regardless of the app theme, so this
            deliberately uses fixed neutrals rather than --card/--muted. */}
        <DialogContent className="sm:max-w-5xl lg:max-w-6xl p-0 overflow-hidden bg-neutral-900 border-neutral-700 text-white shadow-2xl">
          <DialogHeader className="p-4 px-6 bg-neutral-900 border-b border-neutral-700 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                <Package className="size-5 text-primary" />
                {product.name}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-neutral-400">
                SKU: {product.sku} · Kategori: {product.categoryName} · Marka: {product.brand}
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="relative w-full h-[540px] sm:h-[680px] bg-black/95 flex items-center justify-center p-2 sm:p-3 overflow-hidden">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={product.name}
                className="size-full object-contain rounded-lg animate-in zoom-in-95 duration-200"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-neutral-400 py-12">
                <Package className="size-16 stroke-[1.5]" />
                <p className="text-sm font-medium">Bu ürün için henüz yüklenmiş bir görsel yok.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
