"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { getProductPurchases } from "@/lib/api/products";
import { useAsync } from "@/lib/hooks/use-async";
import { useChangedSince } from "@/lib/hooks/use-reset-on-change";
import { useCurrency } from "@/lib/currency-context";
import { useSettings } from "@/lib/settings-context";
import { formatCurrency, formatDateShort, formatNumber } from "@/lib/format";

const HISTORY_LIMIT = 10;

interface ApplyPriceDialogProps {
  open: boolean;
  productId: string;
  productUnit: string;
  /** Both in the base currency, as stored. */
  oldPrice: number | null;
  newPrice: number | null;
  onCancel: () => void;
  /** Empty array = keep every past purchase at its historical price. */
  onConfirm: (itemIds: number[]) => void;
  pending?: boolean;
}

/**
 * Asked before a product's "Son Satın Alış Fiyatı" change is saved: which — if any —
 * of the last few purchase lines should adopt the new price. Unticked lines keep the
 * price they were bought at, so the purchase record stays accurate.
 */
export function ApplyPriceDialog({
  open,
  productId,
  productUnit,
  oldPrice,
  newPrice,
  onCancel,
  onConfirm,
  pending = false,
}: ApplyPriceDialogProps) {
  const { currency, rates } = useCurrency();
  const { showKurus } = useSettings();
  const { data, staleData, error } = useAsync(
    () => getProductPurchases(productId, { limit: HISTORY_LIMIT }),
    [productId],
  );
  const entries = error ? [] : (data ?? staleData ?? null);

  const [selected, setSelected] = useState<Set<number>>(new Set());

  // The most recent purchase is what "son satın alma fiyatı" usually means, so
  // pre-tick it once the list lands; everything older stays untouched unless asked for.
  if (useChangedSince(entries)) {
    setSelected(entries && entries.length > 0 ? new Set([entries[0].itemId]) : new Set());
  }

  function toggle(itemId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  const money = (value: number | null) =>
    value != null ? formatCurrency(value, currency, rates?.[currency] || 1, showKurus) : "—";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Satın alma fiyatı değişti</DialogTitle>
          <DialogDescription>
            Bu fiyat bundan sonraki satın almalarda geçerli olacak. İsterseniz aşağıdaki geçmiş
            satın alım kayıtlarına da işleyebilirsiniz — işaretlemedikleriniz eski fiyatıyla kalır.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-3 rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm">
          <span className="tabular-nums text-muted-foreground line-through">{money(oldPrice)}</span>
          <ArrowRight className="size-4 text-muted-foreground" />
          <span className="tabular-nums font-semibold text-foreground">{money(newPrice)}</span>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Son {HISTORY_LIMIT} satın alım
          </p>
          {entries === null ? (
            <div className="space-y-1.5">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          ) : entries.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Bu ürün için kayıtlı satın alma bulunmuyor.
            </p>
          ) : (
            <div className="max-h-64 space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
              {entries.map((e) => (
                <label
                  key={e.itemId}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selected.has(e.itemId)}
                    onCheckedChange={() => toggle(e.itemId)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{e.code}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.supplierName}
                      {e.receivedAt ?? e.createdAt
                        ? ` · ${formatDateShort((e.receivedAt ?? e.createdAt)!)}`
                        : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatNumber(e.quantity)} {productUnit}
                    </p>
                    <p className="text-sm tabular-nums font-medium text-foreground">
                      {money(e.unitPrice)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Vazgeç
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onConfirm([])} disabled={pending}>
              Sadece bundan sonrası
            </Button>
            <Button
              type="button"
              onClick={() => onConfirm([...selected])}
              disabled={pending || selected.size === 0}
            >
              Seçilenlere de işle ({selected.size})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
