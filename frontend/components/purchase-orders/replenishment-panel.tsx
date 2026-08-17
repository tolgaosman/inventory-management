"use client";

import { useMemo, useState } from "react";
import { PackageCheck } from "lucide-react";
import { PanelCard } from "@/components/common/panel-card";
import { EmptyState } from "@/components/common/empty-state";
import { StockStatusBadge } from "@/components/common/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductImageThumbnail } from "@/components/common/product-image-thumbnail";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { ReplenishmentSuggestion } from "@/lib/api/purchase-orders";

export function ReplenishmentPanel({
  suggestions,
  loading,
  currency,
  rate,
  onCreateOrders,
}: {
  suggestions: ReplenishmentSuggestion[];
  loading: boolean;
  currency: string;
  rate: number;
  onCreateOrders: (lines: { productId: string; quantity: number }[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  function qtyFor(s: ReplenishmentSuggestion): number {
    return quantities[s.productId] ?? s.suggestedQty;
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = suggestions.length > 0 && suggestions.every((s) => selected.has(s.productId));
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(suggestions.map((s) => s.productId)));
  }

  const estimatedCost = useMemo(
    () =>
      suggestions
        .filter((s) => selected.has(s.productId))
        .reduce((sum, s) => sum + qtyFor(s) * s.unitPrice, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suggestions, selected, quantities],
  );

  function handleCreate() {
    const lines = suggestions
      .filter((s) => selected.has(s.productId))
      .map((s) => ({ productId: s.productId, quantity: qtyFor(s) }))
      .filter((l) => l.quantity > 0);
    onCreateOrders(lines);
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <PanelCard>
        <EmptyState
          icon={PackageCheck}
          title="İkmal gerektiren ürün yok"
          description="Tüm ürünler minimum seviyenin üzerinde veya zaten siparişi verilmiş."
        />
      </PanelCard>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-soft">
        <div className="flex items-center gap-3">
          <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Tümünü seç" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{formatNumber(suggestions.length)}</span> üründe ikmal gerekiyor
            {selected.size > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-foreground">{formatNumber(selected.size)}</span> seçili · tahmini maliyet{" "}
                <span className="font-semibold text-foreground">{formatCurrency(estimatedCost / rate, currency, 1, true)}</span>
              </>
            )}
          </p>
        </div>
        <Button size="sm" onClick={handleCreate} disabled={selected.size === 0}>
          Seçilenlerden Sipariş Oluştur
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
                <th className="w-10 px-4 py-2.5"></th>
                <th className="px-2 py-2.5">Ürün</th>
                <th className="px-2 py-2.5 text-center">Durum</th>
                <th className="px-2 py-2.5 text-center">Mevcut</th>
                <th className="px-2 py-2.5 text-center">Min</th>
                <th className="px-2 py-2.5 text-center">Yolda</th>
                <th className="w-28 px-2 py-2.5 text-center">Önerilen</th>
                <th className="px-2 py-2.5 text-left">Tedarikçi</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s) => {
                const isSelected = selected.has(s.productId);
                return (
                  <tr key={s.productId} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-2.5">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(s.productId)}
                        aria-label={`${s.name} seç`}
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <ProductImageThumbnail src={s.imageUrl} alt={s.name} size="xs" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{s.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{s.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <div className="flex justify-center">
                        <StockStatusBadge level={s.severity === "kritik" ? "kritik" : "dusuk"} />
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={s.severity === "kritik" ? "font-semibold tabular-nums text-status-critical" : "tabular-nums text-foreground"}>
                        {formatNumber(s.totalStock)}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center tabular-nums text-muted-foreground">{formatNumber(s.minStock)}</td>
                    <td className="px-2 py-2.5 text-center">
                      <span className="tabular-nums text-muted-foreground">{formatNumber(s.onOrder)}</span>
                      {s.draftOnOrder > 0 && (
                        <Badge variant="outline" className="ml-1.5 text-micro">
                          +{formatNumber(s.draftOnOrder)} taslakta
                        </Badge>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <Input
                        type="number"
                        min={0}
                        value={qtyFor(s)}
                        onChange={(e) =>
                          setQuantities((prev) => ({ ...prev, [s.productId]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))
                        }
                        className="h-8 text-center"
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="block truncate text-xs text-muted-foreground" title={s.supplierName}>
                        {s.supplierName}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
