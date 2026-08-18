"use client";

import { useMemo, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/common/empty-state";
import { useAsync } from "@/lib/hooks/use-async";
import { useCurrency } from "@/lib/currency-context";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { listDraftOrdersBySupplier, type DraftOrderOption } from "@/lib/api/quotes";
import type { Supplier } from "@/lib/types";

interface QuoteRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: Supplier[];
  onContinue: (selection: { supplierId: string; purchaseOrderIds: string[] }) => void;
}

export function QuoteRequestDialog({ open, onOpenChange, suppliers, onContinue }: QuoteRequestDialogProps) {
  const { currency, rates } = useCurrency();
  const rate = rates?.[currency] || 1;

  const { data: grouped, status } = useAsync(() => listDraftOrdersBySupplier(), [open]);
  const bySupplier = useMemo(() => grouped ?? {}, [grouped]);

  const suppliersWithDrafts = useMemo(
    () => suppliers.filter((s) => (bySupplier[s.id]?.length ?? 0) > 0),
    [suppliers, bySupplier],
  );

  const [supplierId, setSupplierId] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSupplierId("");
      setSelected(new Set());
    }
    onOpenChange(next);
  }

  const orders: DraftOrderOption[] = supplierId ? bySupplier[supplierId] ?? [] : [];

  function changeSupplier(id: string) {
    setSupplierId(id);
    setSelected(new Set());
  }

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function handleContinue() {
    if (!supplierId || selected.size === 0) return;
    onContinue({ supplierId, purchaseOrderIds: [...selected] });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Teklif Formu Oluştur</DialogTitle>
          <DialogDescription>
            Bir tedarikçi seçin, ardından teklif isteğine dahil edilecek taslak veya onay bekleyen siparişleri işaretleyin.
          </DialogDescription>
        </DialogHeader>

        {status !== "loading" && suppliersWithDrafts.length === 0 ? (
          <EmptyState
            title="Uygun sipariş yok"
            description="Teklif formu oluşturulabilecek taslak veya onay bekleyen sipariş yok. Önce bir sipariş oluşturun."
          />
        ) : (
          <div className="space-y-4 px-4 pb-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tedarikçi</label>
              <Select value={supplierId} onValueChange={(v) => changeSupplier(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {supplierId
                      ? suppliers.find((s) => s.id === supplierId)?.name
                      : "Tedarikçi seçin"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {suppliersWithDrafts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({bySupplier[s.id]?.length ?? 0} uygun sipariş)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {supplierId && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Taslak / Onay Bekleyen Siparişler</label>
                <div className="space-y-2">
                  {orders.map((o) => (
                    <label
                      key={o.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5 hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={selected.has(o.id)}
                        onCheckedChange={(checked) => toggle(o.id, Boolean(checked))}
                      />
                      <div className="flex flex-1 items-center justify-between gap-2 text-sm">
                        <span className="font-mono text-xs font-semibold">{o.code}</span>
                        <span
                          className={
                            o.status === "pending_approval"
                              ? "rounded px-1.5 py-0.5 text-[0.65rem] font-medium bg-tint-amber/12 text-tint-amber"
                              : "rounded px-1.5 py-0.5 text-[0.65rem] font-medium bg-muted text-muted-foreground"
                          }
                        >
                          {o.status === "pending_approval" ? "Onay Bekliyor" : "Taslak"}
                        </span>
                        <span className="text-xs text-muted-foreground">{o.itemCount} kalem</span>
                        <span className="text-xs font-medium tabular-nums">
                          {formatCurrency(o.total / rate, currency, 1, true)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Beklenen: {formatDateShort(o.expectedAt)}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="button" onClick={handleContinue} disabled={!supplierId || selected.size === 0}>
            Devam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
