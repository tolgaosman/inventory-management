"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, type LucideIcon } from "lucide-react";
import { TINTS, type TintName } from "@/lib/tints";
import { cn } from "@/lib/utils";
import { PanelCard } from "@/components/common/panel-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { PurchaseStatusBadge } from "@/components/common/status-badge";
import { receivePercent } from "@/lib/purchase-order-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/common/submit-button";
import { ProductPicker } from "@/components/products/product-picker";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import { useWarehouseQuantity } from "@/lib/hooks/use-warehouse-quantity";
import { useAsync } from "@/lib/hooks/use-async";
import { useAuth } from "@/lib/auth";
import { createStockIn, createStockOut } from "@/lib/api/movements";
import { getProduct } from "@/lib/api/products";
import { getProductStockMatrix } from "@/lib/api/warehouses";
import {
  getPendingReceiptOrders,
  receivePurchaseOrder,
  uploadPurchaseOrderInvoice,
  type PendingReceiptOrder,
} from "@/lib/api/purchase-orders";
import { ApiError } from "@/lib/api/client";
import { MOVEMENT_REASON_LABELS } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import type { MovementReason } from "@/lib/types";

type OutReason = Extract<MovementReason, "satis" | "fire" | "sayim_duzeltme">;
const OUT_REASONS: OutReason[] = ["satis", "fire", "sayim_duzeltme"];

interface WarehouseOption {
  id: string;
  name: string;
}

interface SupplierOption {
  id: string;
  name: string;
}

const MODE_META = {
  giris: { title: "Stok Girişi", icon: ArrowDownToLine, cta: "Girişi Kaydet", tint: "positive" },
  cikis: { title: "Stok Çıkışı", icon: ArrowUpFromLine, cta: "Çıkışı Kaydet", tint: "critical" },
} as const satisfies Record<string, { title: string; icon: LucideIcon; cta: string; tint: TintName }>;

/** productId */
type PendingLineKey = `${string}:${string}`;

export function StockEntryForm({
  mode,
  warehouses,
  suppliers,
  onDone,
}: {
  mode: "giris" | "cikis";
  warehouses: WarehouseOption[];
  suppliers: SupplierOption[];
  onDone: () => void;
}) {
  const { userId } = useAuth();
  const { pending, guard } = useSubmitGuard();
  const meta = MODE_META[mode];

  const [warehouseId, setWarehouseId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<OutReason>("satis");
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");

  // Satın alıma bağlı giriş: bir veya birden fazla bekleyen (fatura yüklü,
  // "ordered"/"partially_received") siparişten seçilen kalemleri tek
  // seferde stoğa işler. Var olan `receivePurchaseOrder` akışını kullanır —
  // Satın Alma sayfasındaki "Teslim Al" ile aynı arka uç mantığı.
  const [linkToPurchase, setLinkToPurchase] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [receivedQty, setReceivedQty] = useState<Partial<Record<PendingLineKey, number>>>({});
  const [uploadingInvoiceForId, setUploadingInvoiceForId] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const deepLinkOrderId = mode === "giris" ? searchParams.get("purchaseOrderId") : null;
  const deepLinkAppliedRef = useRef(false);

  const { data: product } = useAsync(
    () => (productId ? getProduct(productId) : Promise.resolve(undefined)),
    [productId],
  );

  useEffect(() => {
    if (product && product.supplierId) {
      setSupplierId(product.supplierId);
    }
  }, [product]);

  const { data: matrix } = useAsync(
    () => (warehouseId ? getProductStockMatrix({ warehouseId }) : Promise.resolve(undefined)),
    [warehouseId],
  );
  const stockByProductId = useMemo(() => {
    if (!matrix || !warehouseId) return undefined;
    const map: Record<string, number> = {};
    for (const row of matrix) map[row.productId] = row.stocksByWarehouse[warehouseId] ?? 0;
    return map;
  }, [matrix, warehouseId]);

  const currentQuantity = useWarehouseQuantity(productId || undefined, warehouseId);
  const qtyNumber = Number(quantity) || 0;
  const previewQuantity =
    currentQuantity == null
      ? null
      : mode === "giris"
        ? currentQuantity + qtyNumber
        : Math.max(currentQuantity - qtyNumber, 0);

  const insufficientStock = mode === "cikis" && currentQuantity != null && qtyNumber > currentQuantity;

  // Depo, siparişin kendi teslimat deposundan (PurchaseOrder.warehouseId)
  // geldiği için bu modda ayrıca seçtirilmiyor — bekleyen tüm siparişler,
  // hangi depoya gideceği kartta gösterilerek tek listede sunulur.
  const { data: pendingOrders, refetch: refetchPendingOrders } = useAsync(
    () => (mode === "giris" && linkToPurchase ? getPendingReceiptOrders() : Promise.resolve<PendingReceiptOrder[]>([])),
    [mode, linkToPurchase],
  );

  async function handleInvoiceUpload(order: PendingReceiptOrder, file: File) {
    setUploadingInvoiceForId(order.id);
    try {
      await uploadPurchaseOrderInvoice(order.id, file);
      toast.success("Fatura yüklendi.", { description: order.code });
      refetchPendingOrders();
    } catch (err) {
      toast.error("Fatura yüklenemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
    } finally {
      setUploadingInvoiceForId(null);
    }
  }

  // Bildirim zilindeki "Satın Alınanlar" sekmesinden gelen derin bağlantı:
  // ?purchaseOrderId=... geldiğinde checkbox'ı otomatik işaretle, siparişi
  // otomatik işaretli listeye ekle.
  useEffect(() => {
    if (!deepLinkOrderId || deepLinkAppliedRef.current) return;
    deepLinkAppliedRef.current = true;
    setLinkToPurchase(true);
    getPendingReceiptOrders()
      .then((orders) => {
        const match = orders.find((o) => o.id === deepLinkOrderId);
        if (!match) return;
        setSelectedOrderIds(new Set([match.id]));
        setReceivedQty((prev) => {
          const next = { ...prev };
          for (const item of match.items) next[`${match.id}:${item.productId}`] = item.outstandingQuantity;
          return next;
        });
      })
      .catch(() => {
        // Sessizce yok say: sipariş artık bekleyen listede değilse (biri
        // zaten teslim almış olabilir) kullanıcı formu elle doldurabilir.
      });
  }, [deepLinkOrderId]);

  const purchaseTotal = Object.values(receivedQty).reduce<number>((sum, n) => sum + (n ?? 0), 0);

  function toggleOrder(order: PendingReceiptOrder, checked: boolean) {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(order.id);
      else next.delete(order.id);
      return next;
    });
    setReceivedQty((prev) => {
      const next = { ...prev };
      if (checked) {
        for (const item of order.items) next[`${order.id}:${item.productId}`] = item.outstandingQuantity;
      } else {
        for (const item of order.items) delete next[`${order.id}:${item.productId}`];
      }
      return next;
    });
  }

  function setLineQty(orderId: string, productId: string, outstanding: number, raw: string) {
    const n = Math.max(0, Math.min(outstanding, Math.floor(Number(raw) || 0)));
    setReceivedQty((prev) => ({ ...prev, [`${orderId}:${productId}`]: n }));
  }

  function resetPurchaseLinkState() {
    setLinkToPurchase(false);
    setSelectedOrderIds(new Set());
    setReceivedQty({});
  }

  function resetForKeepingWarehouse() {
    setProductId("");
    setQuantity("");
    setNote("");
    setSupplierId("");
    setReason("satis");
    resetPurchaseLinkState();
  }

  async function handlePurchaseLinkSubmit() {
    if (selectedOrderIds.size === 0 || purchaseTotal <= 0) return;

    await guard(async (idempotencyKey) => {
      try {
        let receivedAny = false;
        for (const orderId of selectedOrderIds) {
          const order = pendingOrders?.find((o) => o.id === orderId);
          if (!order) continue;

          const quantities: Record<string, number> = {};
          for (const item of order.items) {
            const q = receivedQty[`${orderId}:${item.productId}`] ?? 0;
            if (q > 0) quantities[item.productId] = q;
          }
          if (Object.keys(quantities).length === 0) continue;

          await receivePurchaseOrder(orderId, quantities, {
            userId,
            idempotencyKey: `${idempotencyKey}-${orderId}`,
          });
          receivedAny = true;
        }

        if (receivedAny) {
          toast.success("Stok girişi kaydedildi.", {
            description: `${formatNumber(purchaseTotal)} adet stoğa işlendi.`,
          });
          resetForKeepingWarehouse();
          onDone();
        }
      } catch (err) {
        toast.error("Stok girişi başarısız", {
          description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
        });
      }
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (mode === "giris" && linkToPurchase) {
      await handlePurchaseLinkSubmit();
      return;
    }

    if (!product) return;

    if (product.status === "pasif") {
      toast.error("İşlem Yapılamaz", {
        description: `"${product.name}" pasif durumda olduğu için stok hareketi yapılamaz.`,
      });
      return;
    }

    await guard(async (idempotencyKey) => {
      try {
        if (mode === "giris") {
          await createStockIn({
            productId,
            warehouseId,
            quantity: qtyNumber,
            supplierId: supplierId || undefined,
            note: note || undefined,
            userId,
            idempotencyKey,
          });
        } else {
          await createStockOut({
            productId,
            warehouseId,
            quantity: qtyNumber,
            reason,
            note: note || undefined,
            userId,
            idempotencyKey,
          });
        }
        toast.success(`${meta.title} kaydedildi.`, {
          description: `${product.name} — ${formatNumber(qtyNumber)} ${product.unit}`,
        });
        resetForKeepingWarehouse();
        onDone();
      } catch (err) {
        toast.error(`${meta.title} başarısız`, {
          description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
        });
      }
    });
  }

  const canSubmit =
    mode === "giris" && linkToPurchase
      ? selectedOrderIds.size > 0 && purchaseTotal > 0
      : Boolean(productId) && Boolean(warehouseId) && qtyNumber > 0 && !insufficientStock;

  return (
    <PanelCard
      className="h-auto self-start"
      bodyClassName="flex-none"
      title={
        <span className="flex items-center gap-2.5">
          {/* Tinted chip rather than a grey icon: giriş reads positive,
              çıkış reads critical, matching the KPI card above it. */}
          <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", TINTS[meta.tint])}>
            <meta.icon className="size-4" />
          </span>
          {meta.title}
        </span>
      }
    >
        <form onSubmit={handleSubmit} className="space-y-3">
          {!(mode === "giris" && linkToPurchase) && (
            <div className="space-y-2">
              <Label>Depo</Label>
              <Select
                value={warehouseId}
                onValueChange={(v) => {
                  setWarehouseId((v as string) ?? "");
                  setProductId("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {warehouseId ? warehouses.find((w) => w.id === warehouseId)?.name : "Depo seçin"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === "giris" && (
            <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border/60 p-2.5">
              <Checkbox
                checked={linkToPurchase}
                onCheckedChange={(c) => {
                  const checked = Boolean(c);
                  setLinkToPurchase(checked);
                  if (!checked) {
                    setSelectedOrderIds(new Set());
                    setReceivedQty({});
                  }
                }}
              />
              <span className="text-sm text-foreground">Bu bir satın alım teslimatı</span>
            </label>
          )}

          {mode === "giris" && linkToPurchase ? (
            <div className="space-y-2">
              <Label>Bekleyen Satın Alımlar</Label>
              {pendingOrders && pendingOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground">Teslim alınmayı bekleyen sipariş yok.</p>
              ) : (
                <div className="space-y-2">
                  {(pendingOrders ?? []).map((order) => {
                    const checked = selectedOrderIds.has(order.id);
                    const percent = receivePercent(order.receivedTotal, order.orderedTotal);
                    return (
                      <div key={order.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => toggleOrder(order, Boolean(c))}
                          />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <p className="truncate text-sm font-medium text-foreground">
                              {order.code} — {order.supplierName}
                            </p>
                            <div className="flex items-center gap-2">
                              <PurchaseStatusBadge status={order.status} />
                              <span className="text-xs text-muted-foreground">
                                {order.warehouseName} · {order.items.length} kalem bekliyor
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={percent} className="h-1.5 w-full max-w-32">
                                <ProgressTrack className="h-1.5">
                                  <ProgressIndicator />
                                </ProgressTrack>
                              </Progress>
                              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                %{percent} teslim alındı
                              </span>
                            </div>
                          </div>
                        </label>
                        <div className="pl-6">
                          {order.hasInvoice ? (
                            <p className="text-[11px] text-muted-foreground">Fatura yüklendi.</p>
                          ) : (
                            <label
                              className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="shrink-0">
                                {uploadingInvoiceForId === order.id ? "Fatura yükleniyor…" : "Fatura yükle (opsiyonel):"}
                              </span>
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                disabled={uploadingInvoiceForId === order.id}
                                className="min-w-0 flex-1 text-[11px] file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-[11px]"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) void handleInvoiceUpload(order, file);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          )}
                        </div>
                        {checked && (
                          <div className="space-y-2 pl-6">
                            {order.items.map((item) => (
                              <div key={item.productId} className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-medium text-foreground">{item.productName}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    Kalan: {formatNumber(item.outstandingQuantity)} {item.unit}
                                  </p>
                                </div>
                                <Input
                                  type="number"
                                  min={0}
                                  max={item.outstandingQuantity}
                                  className="w-20 shrink-0"
                                  value={receivedQty[`${order.id}:${item.productId}`] ?? 0}
                                  onChange={(e) => setLineQty(order.id, item.productId, item.outstandingQuantity, e.target.value)}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedOrderIds.size > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
                  <span className="text-sm font-medium text-muted-foreground">Stoğa işlenecek toplam</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">{formatNumber(purchaseTotal)}</span>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Ürün</Label>
                <ProductPicker
                  value={productId}
                  onChange={setProductId}
                  stockByProductId={stockByProductId}
                  excludeZeroStock={mode === "cikis"}
                />
                {warehouseId && productId && currentQuantity != null && (
                  <p className="text-xs text-muted-foreground">
                    Mevcut: <span className="font-medium text-foreground">{formatNumber(currentQuantity)}</span>{" "}
                    {product?.unit}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Miktar</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                />
                {insufficientStock && (
                  <p className="text-xs font-medium text-destructive">
                    Yetersiz stok: bu depoda {formatNumber(currentQuantity ?? 0)} adet var.
                  </p>
                )}
                {!insufficientStock && previewQuantity != null && qtyNumber > 0 && (
                  <div
                    className={
                      mode === "giris"
                        ? "rounded-md bg-status-good/10 px-3 py-2 text-xs text-status-good"
                        : "rounded-md bg-status-critical/10 px-3 py-2 text-xs text-status-critical"
                    }
                  >
                    Eski stok: <span className="font-medium">{formatNumber(currentQuantity ?? 0)}</span>
                    {mode === "cikis" && (
                      <>
                        {" "}
                        · Çıkış: <span className="font-medium">{formatNumber(qtyNumber)}</span>
                      </>
                    )}{" "}
                    · Yeni stok: <span className="font-medium">{formatNumber(previewQuantity)}</span> {product?.unit}
                  </div>
                )}
              </div>

              {mode === "cikis" ? (
                <div className="space-y-2">
                  <Label>Sebep</Label>
                  <Select value={reason} onValueChange={(v) => setReason(v as OutReason)}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{MOVEMENT_REASON_LABELS[reason]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {OUT_REASONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {MOVEMENT_REASON_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                suppliers.length > 0 && (
                  <div className="space-y-2">
                    <Label>Tedarikçi (opsiyonel)</Label>
                    <Select value={supplierId} onValueChange={(v) => setSupplierId((v as string) ?? "")}>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                           {supplierId ? suppliers.find((s) => s.id === supplierId)?.name : "Tedarikçi seçin"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers
                          .filter((s) => !product || s.id === product.supplierId)
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              )}

              <div className="space-y-2">
                <Label htmlFor="note">Açıklama (opsiyonel)</Label>
                <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={1} />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={resetForKeepingWarehouse}>
              Formu Temizle
            </Button>
            <SubmitButton type="submit" pending={pending} disabled={!canSubmit}>
              {meta.cta}
            </SubmitButton>
          </div>
        </form>
    </PanelCard>
  );
}
