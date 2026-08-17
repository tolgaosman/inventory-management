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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/common/submit-button";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import { useChangedSince } from "@/lib/hooks/use-reset-on-change";
import type { ReplenishmentSuggestion } from "@/lib/api/purchase-orders";

interface WarehouseOption {
  id: string;
  name: string;
}

/**
 * Confirms delivery warehouse + expected date, previews how many draft
 * orders will be created (one per supplier), then hands off to the parent.
 * Same division of labour as the other sheets: this dialog owns the form and
 * closes on success; the parent owns the API call, success toast (it knows
 * exactly how many orders came back), and refetching.
 */
export function ReplenishmentOrderDialog({
  open,
  onOpenChange,
  lines,
  suggestions,
  warehouses,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: { productId: string; quantity: number }[];
  suggestions: ReplenishmentSuggestion[];
  warehouses: WarehouseOption[];
  onConfirm: (input: { warehouseId: string; expectedAt: string; lines: { productId: string; quantity: number }[] }) => Promise<void>;
}) {
  const { pending, guard } = useSubmitGuard();
  const [warehouseId, setWarehouseId] = useState("");
  const [expectedAt, setExpectedAt] = useState("");

  if (useChangedSince(open) && open) {
    setWarehouseId("");
    setExpectedAt("");
  }

  const supplierGroups = useMemo(() => {
    const bySupplier = new Map<string, { supplierName: string; count: number }>();
    for (const line of lines) {
      const s = suggestions.find((x) => x.productId === line.productId);
      if (!s) continue;
      const g = bySupplier.get(s.supplierId) ?? { supplierName: s.supplierName, count: 0 };
      g.count++;
      bySupplier.set(s.supplierId, g);
    }
    return [...bySupplier.values()];
  }, [lines, suggestions]);

  const canSubmit = Boolean(warehouseId) && Boolean(expectedAt) && lines.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    await guard(async () => {
      await onConfirm({ warehouseId, expectedAt: new Date(expectedAt).toISOString(), lines });
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seçilenlerden Sipariş Oluştur</DialogTitle>
          <DialogDescription>
            {supplierGroups.length > 0
              ? `${supplierGroups.length} tedarikçi için ${supplierGroups.length} taslak sipariş oluşturulacak.`
              : "Seçili ürün bulunamadı."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {supplierGroups.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              {supplierGroups.map((g) => (
                <li key={g.supplierName} className="flex items-center justify-between">
                  <span className="text-foreground">{g.supplierName}</span>
                  <span className="text-muted-foreground">{g.count} kalem</span>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2">
            <Label>Teslim Deposu</Label>
            <Select value={warehouseId} onValueChange={(v) => setWarehouseId((v as string) ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue>{warehouseId ? warehouses.find((w) => w.id === warehouseId)?.name : "Depo seçin"}</SelectValue>
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
            <Label htmlFor="replenish-expected-at">Beklenen Teslim Tarihi</Label>
            <Input
              id="replenish-expected-at"
              type="date"
              value={expectedAt}
              onChange={(e) => setExpectedAt(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <SubmitButton type="submit" pending={pending} disabled={!canSubmit}>
              Siparişleri Oluştur
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
