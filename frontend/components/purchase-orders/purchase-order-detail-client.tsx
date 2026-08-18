"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Send,
  PackageCheck,
  MoreHorizontal,
  Ban,
  Trash2,
  Building2,
  Warehouse,
  CalendarClock,
  Wallet,
  Boxes,
  Gauge,
  Hourglass,
  BadgeCheck,
  Undo2,
} from "lucide-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PurchaseStatusBadge } from "@/components/common/status-badge";
import { ProductImageThumbnail } from "@/components/common/product-image-thumbnail";
import { PurchaseOrderFormSheet } from "@/components/purchase-orders/purchase-order-form-sheet";
import { PurchaseOrderReceiveSheet } from "@/components/purchase-orders/purchase-order-receive-sheet";
import { useAsync } from "@/lib/hooks/use-async";
import { useCurrency } from "@/lib/currency-context";
import { getAvailableActions } from "@/lib/purchase-order-actions";
import { listSuppliers, listWarehouses } from "@/lib/api/catalog";
import {
  getPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  markPurchaseOrderOrdered,
  requestPurchaseOrderApproval,
  approvePurchaseOrder,
  rejectPurchaseOrderApproval,
  cancelPurchaseOrder,
} from "@/lib/api/purchase-orders";
import { ApiError } from "@/lib/api/client";
import { formatNumber, formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { useRouter } from "next/navigation";

export function PurchaseOrderDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { currency, rates } = useCurrency();
  const rate = rates?.[currency] || 1;

  const [formOpen, setFormOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { status, data, staleData, error, refetch } = useAsync(() => getPurchaseOrder(id), [id]);
  const view = data ?? staleData;

  const { data: refData } = useAsync(
    () => Promise.all([listSuppliers({ pageSize: 1000 }), listWarehouses()]),
    [],
  );
  const suppliers = refData?.[0]?.rows ?? [];
  const warehouses = refData?.[1] ?? [];

  async function handleSaved(values: {
    supplierId: string;
    warehouseId: string;
    expectedAt: string;
    notes?: string;
    items: { productId: string; quantity: number; unitPrice: number }[];
  }) {
    try {
      await updatePurchaseOrder(id, values);
      refetch();
    } catch (err) {
      toast.error("Sipariş güncellenemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
      throw err;
    }
  }

  async function handleMarkOrdered() {
    try {
      await markPurchaseOrderOrdered(id);
      toast.success("Sipariş gönderildi.");
      refetch();
    } catch (err) {
      toast.error("Sipariş gönderilemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
    }
  }

  async function handleRequestApproval() {
    try {
      await requestPurchaseOrderApproval(id);
      toast.success("Sipariş onaya gönderildi.");
      refetch();
    } catch (err) {
      toast.error("Sipariş onaya gönderilemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
    }
  }

  async function handleApprove() {
    try {
      await approvePurchaseOrder(id);
      toast.success("Sipariş onaylandı.");
      refetch();
    } catch (err) {
      toast.error("Sipariş onaylanamadı", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
    }
  }

  async function handleReject() {
    try {
      await rejectPurchaseOrderApproval(id);
      toast.success("Onay reddedildi.");
      refetch();
    } catch (err) {
      toast.error("Onay reddedilemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
    }
  }

  async function handleCancel() {
    try {
      await cancelPurchaseOrder(id);
      toast.success("Sipariş iptal edildi.");
      setCancelling(false);
      refetch();
    } catch (err) {
      toast.error("Sipariş iptal edilemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
      setCancelling(false);
    }
  }

  async function handleDelete() {
    try {
      await deletePurchaseOrder(id);
      toast.success("Sipariş silindi.");
      router.push("/satin-alma");
    } catch (err) {
      toast.error("Sipariş silinemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
      setDeleting(false);
    }
  }

  if (status === "error" && !view) {
    return (
      <div className="space-y-6">
        <PageHeader title="Sipariş Detayı" />
        <ErrorState message={error?.message} onRetry={refetch} />
      </div>
    );
  }

  if (!view) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-xl lg:col-span-1" />
          <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  const receivedTotal = view.items.reduce((sum, i) => sum + i.receivedQuantity, 0);
  const orderedTotal = view.items.reduce((sum, i) => sum + i.quantity, 0);
  const receivePercent = orderedTotal > 0 ? Math.round((receivedTotal / orderedTotal) * 100) : 0;
  const pendingUnits = orderedTotal - receivedTotal;

  const { canEdit, canDelete, canMarkOrdered, canRequestApproval, canApprove, canReject, canReceive, canCancel } =
    getAvailableActions({
      status: view.status,
      hasReceivedProgress: receivedTotal > 0,
    });

  const fields: { icon: typeof Building2; label: string; value: React.ReactNode }[] = [
    { icon: Building2, label: "Tedarikçi", value: <Link href={`/tedarikciler/${view.supplierId}`} className="hover:underline">{view.supplierName}</Link> },
    { icon: Warehouse, label: "Teslim Deposu", value: <Link href={`/depolar/${view.warehouseId}`} className="hover:underline">{view.warehouseName}</Link> },
    { icon: CalendarClock, label: "Oluşturma", value: formatDateTime(view.createdAt) },
    { icon: CalendarClock, label: "Beklenen Teslim", value: formatDate(view.expectedAt) },
    ...(view.receivedAt
      ? [{ icon: CalendarClock, label: "Teslim Alındı", value: formatDateTime(view.receivedAt) }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/satin-alma"
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Siparişlere dön
        </Link>
        <PageHeader
          title={view.code}
          description={`${view.supplierName} · ${formatDate(view.createdAt)}`}
          actions={
            <Can permission="purchase.manage">
              <>
                {canMarkOrdered && (
                  <Button size="sm" variant="outline" onClick={handleMarkOrdered}>
                    <Send className="size-4" />
                    Siparişi Gönder
                  </Button>
                )}
                {canRequestApproval && (
                  <Button size="sm" variant="outline" onClick={handleRequestApproval}>
                    <Hourglass className="size-4" />
                    Onaya Gönder
                  </Button>
                )}
                {canApprove && (
                  <Button size="sm" variant="outline" onClick={handleApprove}>
                    <BadgeCheck className="size-4" />
                    Siparişi Onayla
                  </Button>
                )}
                {canReject && (
                  <Button size="sm" variant="outline" onClick={handleReject}>
                    <Undo2 className="size-4" />
                    Siparişi Reddet
                  </Button>
                )}
                {canReceive && (
                  <Button size="sm" onClick={() => setReceiveOpen(true)}>
                    <PackageCheck className="size-4" />
                    Teslim Al
                  </Button>
                )}
                {canEdit && (
                  <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
                    <Pencil className="size-4" />
                    Düzenle
                  </Button>
                )}
                {(canCancel || canDelete) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="outline" size="icon" className="size-9">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      {canCancel && (
                        <DropdownMenuItem variant="destructive" onClick={() => setCancelling(true)}>
                          <Ban className="size-4" />
                          İptal Et
                        </DropdownMenuItem>
                      )}
                      {canDelete && (
                        <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
                          <Trash2 className="size-4" />
                          Sil
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            </Can>
          }
        />
      </div>

      <div className={status === "loading" ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card className="py-5 gap-2">
            <CardContent className="flex items-center gap-3 px-5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Wallet className="size-4.5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Toplam Tutar</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">
                  {formatCurrency(view.total / rate, currency, 1, true)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-5 gap-2">
            <CardContent className="flex items-center gap-3 px-5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Boxes className="size-4.5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Kalem Sayısı</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{formatNumber(view.itemCount)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-5 gap-2">
            <CardContent className="flex items-center gap-3 px-5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Gauge className="size-4.5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Teslim Oranı</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">%{receivePercent}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-5 gap-2">
            <CardContent className="flex items-center gap-3 px-5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <PackageCheck className="size-4.5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bekleyen Adet</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{formatNumber(pendingUnits)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="py-5 gap-3 lg:col-span-1">
            <CardHeader className="px-5 pb-2">
              <CardTitle className="text-base font-semibold tracking-tight text-foreground">Sipariş Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pt-2">
              <dl className="divide-y divide-border/60">
                <div className="flex items-center justify-between gap-3 py-2 text-sm">
                  <dt className="shrink-0 text-muted-foreground">Durum</dt>
                  <dd><PurchaseStatusBadge status={view.status} /></dd>
                </div>
                {fields.map((f) => (
                  <div key={f.label} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <dt className="shrink-0 text-muted-foreground">{f.label}</dt>
                    <dd className="min-w-0 truncate text-right font-medium text-foreground">{f.value}</dd>
                  </div>
                ))}
                {view.notes && (
                  <div className="py-2 text-sm">
                    <dt className="mb-1 text-muted-foreground">Notlar</dt>
                    <dd className="text-foreground">{view.notes}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card className="py-5 gap-3 lg:col-span-2">
            <CardHeader className="px-5 pb-2">
              <CardTitle className="text-base font-semibold tracking-tight text-foreground">Kalemler</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pt-2">
              <div className="max-h-[420px] space-y-2 overflow-y-auto custom-scrollbar pr-1">
                {view.items.map((item) => {
                  const percent = item.quantity > 0 ? Math.round((item.receivedQuantity / item.quantity) * 100) : 0;
                  const lineTotal = item.quantity * item.unitPrice;
                  return (
                    <div key={item.productId} className="rounded-lg border border-border/60 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href={`/urunler/${item.productId}`}
                          className="flex min-w-0 items-center gap-2.5 hover:underline"
                        >
                          <ProductImageThumbnail src={item.product.imageUrl} alt={item.product.name} size="xs" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{item.product.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{item.product.sku}</p>
                          </div>
                        </Link>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold tabular-nums text-foreground">
                            {formatCurrency(lineTotal / rate, currency, 1, true)}
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatNumber(item.quantity)} × {formatCurrency(item.unitPrice / rate, currency, 1, true)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={percent} className="h-1.5 flex-1">
                          <ProgressTrack className="h-1.5">
                            <ProgressIndicator />
                          </ProgressTrack>
                        </Progress>
                        <span className="shrink-0 text-micro tabular-nums text-muted-foreground">
                          {formatNumber(item.receivedQuantity)}/{formatNumber(item.quantity)} teslim (%{percent})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <PurchaseOrderFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        order={view}
        suppliers={suppliers}
        warehouses={warehouses}
        onSaved={handleSaved}
      />

      <PurchaseOrderReceiveSheet
        open={receiveOpen}
        onOpenChange={setReceiveOpen}
        order={view}
        warehouseName={view.warehouseName}
        onDone={refetch}
      />

      <AlertDialog open={cancelling} onOpenChange={setCancelling}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Siparişi iptal et</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${view.code}" iptal edilecek. Bu işlem geri alınamaz.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction variant="destructive-solid" onClick={handleCancel}>
              İptal Et
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Siparişi sil</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${view.code}" kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction variant="destructive-solid" onClick={handleDelete}>
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
