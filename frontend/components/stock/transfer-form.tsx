"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";
import { TINTS } from "@/lib/tints";
import { cn } from "@/lib/utils";
import { PanelCard } from "@/components/common/panel-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/common/submit-button";
import { ProductPicker } from "@/components/products/product-picker";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import { useWarehouseQuantity } from "@/lib/hooks/use-warehouse-quantity";
import { useAsync } from "@/lib/hooks/use-async";
import { useAuth } from "@/lib/auth";
import { createTransfer } from "@/lib/api/movements";
import { getProduct } from "@/lib/api/products";
import { getProductStockMatrix } from "@/lib/api/warehouses";
import { ApiError } from "@/lib/api/client";
import { formatNumber } from "@/lib/format";

interface WarehouseOption {
  id: string;
  name: string;
}

export function TransferForm({
  warehouses,
  onDone,
}: {
  warehouses: WarehouseOption[];
  onDone: () => void;
}) {
  const { userId } = useAuth();
  const { pending, guard } = useSubmitGuard();

  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [targetWarehouseId, setTargetWarehouseId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  const { data: product } = useAsync(
    () => (productId ? getProduct(productId) : Promise.resolve(undefined)),
    [productId],
  );

  const { data: matrix } = useAsync(
    () => (sourceWarehouseId ? getProductStockMatrix({ warehouseId: sourceWarehouseId }) : Promise.resolve(undefined)),
    [sourceWarehouseId],
  );
  const stockByProductId = useMemo(() => {
    if (!matrix || !sourceWarehouseId) return undefined;
    const map: Record<string, number> = {};
    for (const row of matrix) map[row.productId] = row.stocksByWarehouse[sourceWarehouseId] ?? 0;
    return map;
  }, [matrix, sourceWarehouseId]);

  const currentQuantity = useWarehouseQuantity(productId || undefined, sourceWarehouseId);
  const qtyNumber = Number(quantity) || 0;
  const previewQuantity = currentQuantity == null ? null : Math.max(currentQuantity - qtyNumber, 0);
  const insufficientStock = currentQuantity != null && qtyNumber > currentQuantity;

  function resetForm() {
    setProductId("");
    setQuantity("");
    setNote("");
  }

  function handleSourceChange(id: string) {
    setSourceWarehouseId(id);
    setProductId("");
    if (targetWarehouseId === id) setTargetWarehouseId("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;

    if (product.status === "pasif") {
      toast.error("İşlem Yapılamaz", {
        description: `"${product.name}" pasif durumda olduğu için stok transferi yapılamaz.`,
      });
      return;
    }

    await guard(async (idempotencyKey) => {
      try {
        await createTransfer({
          productId,
          sourceWarehouseId,
          targetWarehouseId,
          quantity: qtyNumber,
          note: note || undefined,
          userId,
          idempotencyKey,
        });
        toast.success("Transfer kaydedildi.", {
          description: `${product.name} — ${formatNumber(qtyNumber)} ${product.unit}`,
        });
        resetForm();
        onDone();
      } catch (err) {
        toast.error("Transfer başarısız", {
          description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
        });
      }
    });
  }

  const canSubmit =
    Boolean(productId) &&
    Boolean(sourceWarehouseId) &&
    Boolean(targetWarehouseId) &&
    sourceWarehouseId !== targetWarehouseId &&
    qtyNumber > 0 &&
    !insufficientStock;

  return (
    <PanelCard
      className="flex-1"
      bodyClassName="flex-none"
      title={
        <span className="flex items-center gap-2.5">
          <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", TINTS.blue)}>
            <ArrowLeftRight className="size-4" />
          </span>
          Depolar Arası Transfer
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          <Label>Kaynak Depo</Label>
          <Select value={sourceWarehouseId} onValueChange={(v) => handleSourceChange((v as string) ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {sourceWarehouseId ? warehouses.find((w) => w.id === sourceWarehouseId)?.name : "Depo seçin"}
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

        <div className="space-y-2">
          <Label>Hedef Depo</Label>
          <Select value={targetWarehouseId} onValueChange={(v) => setTargetWarehouseId((v as string) ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {targetWarehouseId ? warehouses.find((w) => w.id === targetWarehouseId)?.name : "Hedef depo seçin"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {warehouses
                .filter((w) => w.id !== sourceWarehouseId)
                .map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Ürün</Label>
          <ProductPicker value={productId} onChange={setProductId} stockByProductId={stockByProductId} />
          {sourceWarehouseId && productId && currentQuantity != null && (
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
            <div className="rounded-md bg-primary/10 px-3 py-2 text-xs text-primary">
              Kaynak eski stok: <span className="font-medium">{formatNumber(currentQuantity ?? 0)}</span> · Transfer:{" "}
              <span className="font-medium">{formatNumber(qtyNumber)}</span> · Kaynak yeni stok:{" "}
              <span className="font-medium">{formatNumber(previewQuantity)}</span> {product?.unit}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">Açıklama (opsiyonel)</Label>
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={1} />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={resetForm}>
            Formu Temizle
          </Button>
          <SubmitButton type="submit" pending={pending} disabled={!canSubmit}>
            Transferi Kaydet
          </SubmitButton>
        </div>
      </form>
    </PanelCard>
  );
}
