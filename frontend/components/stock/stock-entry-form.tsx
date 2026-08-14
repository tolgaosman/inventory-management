"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { createStockIn, createStockOut } from "@/lib/api/movements";
import { getProduct } from "@/lib/api/products";
import { getProductStockMatrix } from "@/lib/api/warehouses";
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
  giris: { title: "Stok Girişi", icon: ArrowDownToLine, cta: "Girişi Kaydet" },
  cikis: { title: "Stok Çıkışı", icon: ArrowUpFromLine, cta: "Çıkışı Kaydet" },
} as const;

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

  const { data: product } = useAsync(
    () => (productId ? getProduct(productId) : Promise.resolve(undefined)),
    [productId],
  );

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

  function resetForKeepingWarehouse() {
    setProductId("");
    setQuantity("");
    setNote("");
    setSupplierId("");
    setReason("satis");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    Boolean(productId) && Boolean(warehouseId) && qtyNumber > 0 && !insufficientStock;

  return (
    <Card className="py-5 gap-3">
      <CardHeader className="px-5 pb-0">
        <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <meta.icon className="size-4 text-muted-foreground" />
          {meta.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5">
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="space-y-2">
            <Label>Ürün</Label>
            <ProductPicker value={productId} onChange={setProductId} stockByProductId={stockByProductId} />
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
                    {suppliers.map((s) => (
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
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={resetForKeepingWarehouse}>
              Formu Temizle
            </Button>
            <SubmitButton type="submit" pending={pending} disabled={!canSubmit}>
              {meta.cta}
            </SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
