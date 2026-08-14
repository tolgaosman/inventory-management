"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/common/submit-button";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import { useAuth } from "@/lib/auth";
import { createStockIn, createStockOut, createTransfer } from "@/lib/api/movements";
import { ApiError } from "@/lib/api/client";
import { MOVEMENT_REASON_LABELS } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { ProductImageThumbnail } from "@/components/common/product-image-thumbnail";
import { useWarehouseQuantity } from "@/lib/hooks/use-warehouse-quantity";
import type { MovementReason, Product } from "@/lib/types";

export type StockMovementMode = "giris" | "cikis" | "transfer";

const OUT_REASONS: Extract<MovementReason, "satis" | "fire" | "sayim_duzeltme">[] = [
  "satis",
  "fire",
  "sayim_duzeltme",
];

const MODE_META: Record<StockMovementMode, { title: string; description: string; icon: typeof ArrowDownToLine }> = {
  giris: { title: "Stok Girişi", description: "Bir depoya yeni stok ekleyin.", icon: ArrowDownToLine },
  cikis: { title: "Stok Çıkışı", description: "Bir depodan stok düşün.", icon: ArrowUpFromLine },
  transfer: { title: "Depolar Arası Transfer", description: "Stoğu iki depo arasında taşıyın.", icon: ArrowLeftRight },
};

interface WarehouseOption {
  id: string;
  name: string;
}

interface SupplierOption {
  id: string;
  name: string;
}

interface StockMovementSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Pick<Product, "id" | "name" | "unit" | "imageUrl"> & { status?: Product["status"] };
  mode: StockMovementMode;
  warehouses: WarehouseOption[];
  suppliers?: SupplierOption[];
  onDone: () => void;
}

export function StockMovementSheet({
  open,
  onOpenChange,
  product,
  mode,
  warehouses,
  suppliers = [],
  onDone,
}: StockMovementSheetProps) {
  const { userId } = useAuth();
  const { pending, guard } = useSubmitGuard();

  const [warehouseId, setWarehouseId] = useState("");
  const [targetWarehouseId, setTargetWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<(typeof OUT_REASONS)[number]>("satis");
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWarehouseId("");
      setTargetWarehouseId("");
      setQuantity("");
      setReason("satis");
      setSupplierId("");
      setNote("");
    }
  }, [open, mode]);

  const currentQuantity = useWarehouseQuantity(product?.id, warehouseId);
  const qtyNumber = Number(quantity) || 0;
  const previewQuantity =
    currentQuantity == null
      ? null
      : mode === "giris"
        ? currentQuantity + qtyNumber
        : Math.max(currentQuantity - qtyNumber, 0);

  const meta = MODE_META[mode];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;

    if (product.status === "pasif") {
      toast.error("İşlem Yapılamaz", { description: `"${product.name}" pasif durumda olduğu için stok hareketi veya transfer yapılamaz.` });
      return;
    }

    await guard(async (idempotencyKey) => {
      try {
        if (mode === "giris") {
          await createStockIn({
            productId: product.id,
            warehouseId,
            quantity: qtyNumber,
            supplierId: supplierId || undefined,
            note: note || undefined,
            userId,
            idempotencyKey,
          });
        } else if (mode === "cikis") {
          await createStockOut({
            productId: product.id,
            warehouseId,
            quantity: qtyNumber,
            reason,
            note: note || undefined,
            userId,
            idempotencyKey,
          });
        } else {
          await createTransfer({
            productId: product.id,
            sourceWarehouseId: warehouseId,
            targetWarehouseId,
            quantity: qtyNumber,
            note: note || undefined,
            userId,
            idempotencyKey,
          });
        }
        toast.success(`${meta.title} kaydedildi.`, {
          description: `${product.name} — ${formatNumber(qtyNumber)} ${product.unit}`,
        });
        onDone();
        onOpenChange(false);
      } catch (err) {
        toast.error(`${meta.title} başarısız`, {
          description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
        });
      }
    });
  }

  const canSubmit =
    Boolean(product) &&
    qtyNumber > 0 &&
    Boolean(warehouseId) &&
    (mode !== "transfer" || (Boolean(targetWarehouseId) && targetWarehouseId !== warehouseId));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            {product && <ProductImageThumbnail src={product.imageUrl} alt={product.name} size="md" />}
            <div>
              <SheetTitle className="flex items-center gap-2">
                <meta.icon className="size-4 text-muted-foreground" />
                {meta.title}
              </SheetTitle>
              <SheetDescription>
                {product ? `${product.name} için ${meta.description.toLowerCase()}` : meta.description}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          <div className="space-y-2">
            <Label>{mode === "transfer" ? "Kaynak Depo" : "Depo"}</Label>
            <Select value={warehouseId} onValueChange={(v) => setWarehouseId((v as string) ?? "")}>
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
            {warehouseId && currentQuantity != null && (
              <p className="text-xs text-muted-foreground">
                Mevcut: <span className="font-medium text-foreground">{formatNumber(currentQuantity)}</span>{" "}
                {product?.unit}
              </p>
            )}
          </div>

          {mode === "transfer" && (
            <div className="space-y-2">
              <Label>Hedef Depo</Label>
              <Select value={targetWarehouseId} onValueChange={(v) => setTargetWarehouseId((v as string) ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {targetWarehouseId
                      ? warehouses.find((w) => w.id === targetWarehouseId)?.name
                      : "Hedef depo seçin"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {warehouses
                    .filter((w) => w.id !== warehouseId)
                    .map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
            {previewQuantity != null && qtyNumber > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatNumber(currentQuantity ?? 0)} → <span className="font-medium text-foreground">{formatNumber(previewQuantity)}</span>{" "}
                {product?.unit}
              </p>
            )}
          </div>

          {mode === "cikis" && (
            <div className="space-y-2">
              <Label>Sebep</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as (typeof OUT_REASONS)[number])}>
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
          )}

          {mode === "giris" && suppliers.length > 0 && (
            <div className="space-y-2">
              <Label>Tedarikçi (opsiyonel)</Label>
              <Select value={supplierId} onValueChange={(v) => setSupplierId((v as string) ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {supplierId ? suppliers.find((s) => s.id === supplierId)?.name : "Tedarikçi seçin"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="note">Not (opsiyonel)</Label>
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>

          <SheetFooter className="flex-row justify-end gap-2 px-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <SubmitButton type="submit" pending={pending} disabled={!canSubmit}>
              Kaydet
            </SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
