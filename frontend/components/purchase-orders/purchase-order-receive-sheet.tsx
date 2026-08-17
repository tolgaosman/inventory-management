"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PackageCheck } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/common/submit-button";
import { EmptyState } from "@/components/common/empty-state";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import { useChangedSince } from "@/lib/hooks/use-reset-on-change";
import { useAuth } from "@/lib/auth";
import { receivePurchaseOrder } from "@/lib/api/purchase-orders";
import { ApiError } from "@/lib/api/client";
import { formatNumber } from "@/lib/format";
import type { getPurchaseOrder } from "@/lib/api/purchase-orders";

type PurchaseOrderDetail = Awaited<ReturnType<typeof getPurchaseOrder>>;

interface PurchaseOrderReceiveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: PurchaseOrderDetail;
  warehouseName?: string;
  /** Called after a successful receipt, to close the sheet's caller state and refetch. */
  onDone: () => void;
}

export function PurchaseOrderReceiveSheet({
  open,
  onOpenChange,
  order,
  warehouseName,
  onDone,
}: PurchaseOrderReceiveSheetProps) {
  const { userId } = useAuth();
  const { pending, guard } = useSubmitGuard();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const pendingItems = (order?.items ?? []).filter((item) => item.receivedQuantity < item.quantity);

  // Reset the entered quantities whenever the sheet (re)opens for an order.
  if (useChangedSince(open ? (order?.id ?? "opening") : "closed")) {
    setQuantities({});
  }

  function setQuantity(productId: string, remaining: number, raw: string) {
    const n = Math.max(0, Math.min(remaining, Math.floor(Number(raw) || 0)));
    setQuantities((prev) => ({ ...prev, [productId]: n }));
  }

  function receiveAll() {
    const next: Record<string, number> = {};
    for (const item of pendingItems) next[item.productId] = item.quantity - item.receivedQuantity;
    setQuantities(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    const total = Object.values(quantities).reduce((sum, n) => sum + n, 0);
    if (total <= 0) return;

    await guard(async (idempotencyKey) => {
      try {
        await receivePurchaseOrder(order.id, quantities, { userId, idempotencyKey });
        toast.success("Teslimat kaydedildi.", {
          description: `${formatNumber(total)} adet teslim alındı, stok güncellendi.`,
        });
        onOpenChange(false);
        onDone();
      } catch (err) {
        toast.error("Teslim alma başarısız", {
          description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
        });
      }
    });
  }

  const total = Object.values(quantities).reduce((sum, n) => sum + n, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Teslim Al{order ? ` — ${order.code}` : ""}</SheetTitle>
          <SheetDescription>
            {warehouseName ? `Teslimat deposu: ${warehouseName}. ` : ""}
            Her kalem için şimdi teslim alınan miktarı girin; stok bu depoya işlenir.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          {pendingItems.length === 0 ? (
            <EmptyState icon={PackageCheck} title="Bekleyen kalem yok" description="Bu siparişin tüm kalemleri teslim alınmış." />
          ) : (
            <>
              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={receiveAll}>
                  Tümünü Teslim Al
                </Button>
              </div>

              <div className="space-y-3">
                {pendingItems.map((item) => {
                  const remaining = item.quantity - item.receivedQuantity;
                  return (
                    <div key={item.productId} className="rounded-lg border border-border/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{item.product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Sipariş: {formatNumber(item.quantity)} · Önceden teslim alınan: {formatNumber(item.receivedQuantity)} ·
                            Kalan: {formatNumber(remaining)} {item.product.unit}
                          </p>
                        </div>
                        <div className="w-24 shrink-0 space-y-1">
                          <Label htmlFor={`recv-${item.productId}`} className="sr-only">
                            Şimdi teslim al
                          </Label>
                          <Input
                            id={`recv-${item.productId}`}
                            type="number"
                            min={0}
                            max={remaining}
                            value={quantities[item.productId] ?? 0}
                            onChange={(e) => setQuantity(item.productId, remaining, e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
                <span className="text-sm font-medium text-muted-foreground">Şimdi teslim alınacak toplam</span>
                <span className="text-sm font-semibold tabular-nums text-foreground">{formatNumber(total)}</span>
              </div>
            </>
          )}

          <SheetFooter className="flex-row justify-end gap-2 px-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <SubmitButton type="submit" pending={pending} disabled={pendingItems.length === 0 || total <= 0}>
              Teslim Al
            </SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
