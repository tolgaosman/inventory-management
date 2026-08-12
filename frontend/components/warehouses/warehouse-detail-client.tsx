"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Package,
  Boxes,
  Wallet,
  MapPin,
  AlertTriangle,
  History,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/error-state";
import { Can } from "@/components/common/can";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MovementTypeBadge } from "@/components/common/status-badge";
import { ProductImageThumbnail } from "@/components/common/product-image-thumbnail";
import { WarehouseFormSheet } from "@/components/warehouses/warehouse-form-sheet";
import { useAsync } from "@/lib/hooks/use-async";
import { useCurrency } from "@/lib/currency-context";
import { getWarehouse, listUsers, listWarehouses } from "@/lib/api/catalog";
import { listWarehousesDetailed, getProductStockMatrix, updateWarehouseInput, deleteWarehouseInput } from "@/lib/api/warehouses";
import { listMovements } from "@/lib/api/movements";
import { ApiError } from "@/lib/api/client";
import { MOVEMENT_REASON_LABELS } from "@/lib/constants";
import { formatCurrency, formatDateTime, formatNumber, formatSigned } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Warehouse } from "@/lib/types";

export function WarehouseDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { currency, rates } = useCurrency();
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { status, data, staleData, error, refetch } = useAsync(
    () =>
      Promise.all([
        listWarehousesDetailed(),
        getWarehouse(id),
        getProductStockMatrix({ warehouseId: id }),
        listMovements({ warehouseId: id, pageSize: 50 }),
        listWarehouses(),
        listUsers(),
      ]),
    [id],
  );
  const view = data ?? staleData;

  async function handleSaved(values: Omit<Warehouse, "id">) {
    try {
      await updateWarehouseInput(id, values);
      refetch();
    } catch (err) {
      toast.error("Depo güncellenemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
      throw err;
    }
  }

  async function handleDelete() {
    try {
      await deleteWarehouseInput(id);
      toast.success("Depo silindi.");
      router.push("/depolar");
    } catch (err) {
      toast.error("Depo silinemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
      setDeleting(false);
    }
  }

  if (status === "error" && !view) {
    return (
      <div className="space-y-6">
        <PageHeader title="Depo Detayı" />
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

  const [detailList, { warehouse, levels }, products, movements, allWarehouses, users] = view;
  const detail = detailList.find((w) => w.id === id);

  if (!detail) {
    return (
      <div className="space-y-6">
        <PageHeader title="Depo Detayı" />
        <ErrorState message="Depo bulunamadı." />
      </div>
    );
  }

  const criticalLevels = levels.filter((l) => l.quantity < l.product.minStock);

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: "Şehir", value: warehouse.city },
    { label: "Adres", value: warehouse.address },
    { label: "Kapasite", value: `${formatNumber(warehouse.capacity)} Adet` },
    { label: "Ürün Çeşidi", value: `${formatNumber(detail.productCount)} SKU` },
    { label: "Kritik Ürün", value: `${formatNumber(criticalLevels.length)} SKU` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/depolar"
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Depolara dön
        </Link>
        <PageHeader
          title={warehouse.name}
          description={`${warehouse.city} · ${warehouse.address}`}
          actions={
            <>
              <Can permission="products.manage">
                <Button size="sm" onClick={() => setFormOpen(true)}>
                  <Pencil className="size-4" />
                  Düzenle
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="outline" size="icon" className="size-9">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
                      <Trash2 className="size-4" />
                      Sil
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Can>
            </>
          }
        />
      </div>

      <div className={status === "loading" ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card className="py-5 gap-2">
            <CardContent className="flex items-center gap-3 px-5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Boxes className="size-4.5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stok Adedi</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{formatNumber(detail.units)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-5 gap-2">
            <CardContent className="flex items-center gap-3 px-5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/100/10 text-primary">
                <Package className="size-4.5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ürün Çeşidi</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{formatNumber(detail.productCount)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-5 gap-2">
            <CardContent className="flex items-center gap-3 px-5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-status-good/10 text-status-good">
                <Wallet className="size-4.5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Envanter Değeri</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">
                  {formatCurrency(detail.totalValue, currency, rates?.[currency] || 1)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-5 gap-2">
            <CardContent className="px-5">
              <p className="text-xs text-muted-foreground">Doluluk</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">%{detail.capacityUsagePercent}</p>
              <Progress value={detail.capacityUsagePercent} className="mt-1.5">
                <ProgressTrack>
                  <ProgressIndicator className={cn(detail.capacityUsagePercent >= 90 && "bg-status-critical")} />
                </ProgressTrack>
              </Progress>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="py-5 gap-3 lg:col-span-1">
            <CardHeader className="px-5 pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
                <MapPin className="size-4 text-muted-foreground" />
                Depo Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pt-2">
              <dl className="divide-y divide-border/60">
                {fields.map((f) => (
                  <div key={f.label} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="font-medium text-foreground text-right">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <div className="space-y-4 lg:col-span-2">
            <Card className="py-5 gap-3">
              <CardHeader className="px-5 pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
                  <Package className="size-4 text-muted-foreground" />
                  Bu Depodaki Ürünler
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pt-2">
                {products.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Bu depoda henüz ürün yok.</p>
                ) : (
                  <div className="max-h-80 space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
                    {products.map((p) => {
                      const qty = p.stocksByWarehouse[id] ?? 0;
                      return (
                        <div key={p.productId} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted/50">
                          <ProductImageThumbnail src={p.imageUrl} alt={p.productName} size="xs" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-foreground">{p.productName}</p>
                            <p className="text-xs text-muted-foreground">
                              <span className="font-mono">{p.sku}</span> · {p.categoryName}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="tabular-nums font-semibold text-foreground">{formatNumber(qty)}</p>
                            {qty < p.minStock ? (
                              <Badge variant="destructive" className="text-micro">Kritik</Badge>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {criticalLevels.length > 0 ? (
              <Card className="py-5 gap-3">
                <CardHeader className="px-5 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
                    <AlertTriangle className="size-4 text-status-critical" />
                    Kritik Stok
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 px-5 pt-2">
                  {criticalLevels.map((l) => (
                    <div key={l.productId} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm">
                      <span className="font-medium text-foreground">{l.product.name}</span>
                      <span className="tabular-nums text-status-critical font-semibold">
                        {formatNumber(l.quantity)} / min {formatNumber(l.product.minStock)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <Card className="py-5 gap-3">
              <CardHeader className="px-5 pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
                  <History className="size-4 text-muted-foreground" />
                  Hareket Geçmişi
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pt-2">
                {movements.rows.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Bu depo için henüz stok hareketi yok.</p>
                ) : (
                  <div className="max-h-96 space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
                    {movements.rows
                      .slice()
                      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                      .map((m) => {
                      const product = products.find((p) => p.productId === m.productId);
                      const targetWarehouse = m.targetWarehouseId
                        ? allWarehouses.find((w) => w.id === m.targetWarehouseId)
                        : undefined;
                      const sourceWarehouse = allWarehouses.find((w) => w.id === m.warehouseId);
                      const user = users.find((u) => u.id === m.userId);
                      const isIncomingTransfer = m.targetWarehouseId === id;
                      return (
                        <div key={m.id} className="rounded-lg px-2 py-2 text-sm hover:bg-muted/50">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <MovementTypeBadge type={m.type} />
                              <span className="text-xs text-muted-foreground">
                                {product?.productName ?? "Bilinmeyen ürün"}
                                {isIncomingTransfer ? ` (${sourceWarehouse?.name ?? "?"} → buraya)` : ""}
                                {" · "}
                                {MOVEMENT_REASON_LABELS[m.reason]}
                                {targetWarehouse && !isIncomingTransfer ? ` → ${targetWarehouse.name}` : ""}
                              </span>
                            </div>
                            <span
                              className={cn(
                                "tabular-nums font-semibold",
                                isIncomingTransfer ? "text-status-good" : m.type === "cikis" ? "text-status-critical" : "text-status-good",
                              )}
                            >
                              {formatSigned(isIncomingTransfer ? m.quantity : m.type === "cikis" ? -m.quantity : m.quantity)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span>
                              {user?.name ?? "Bilinmeyen kullanıcı"} · {formatDateTime(m.createdAt)}
                            </span>
                            {m.note ? <span className="italic">&ldquo;{m.note}&rdquo;</span> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <WarehouseFormSheet open={formOpen} onOpenChange={setFormOpen} warehouse={warehouse} onSaved={handleSaved} />

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Depoyu sil</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${warehouse.name}" kalıcı olarak silinecek. Bu işlem geri alınamaz. Depoda henüz stok varsa silme işlemi engellenecektir.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
