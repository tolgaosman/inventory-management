"use client";

import Link from "next/link";
import { Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PurchaseStatusBadge } from "@/components/common/status-badge";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency-context";
import { useSettings } from "@/lib/settings-context";
import { formatCurrency, formatDateShort, formatNumber } from "@/lib/format";
import type { ProductPurchaseEntry } from "@/lib/api/products";

/** The date the purchase actually happened, falling back to when it was raised. */
function purchaseDate(e: ProductPurchaseEntry): string | null {
  return e.receivedAt ?? e.createdAt ?? null;
}

/**
 * Read-only log of every purchase-order line this product ever appeared on, each
 * with the price it was actually bought at. Editing the product's "Son Satın Alış
 * Fiyatı" does not touch these rows unless the user explicitly ticks them in the
 * price-change dialog, so this stays a faithful record of past purchases.
 */
export function PurchaseHistoryCard({
  entries,
  unit,
}: {
  entries: ProductPurchaseEntry[];
  unit: string;
}) {
  const { can } = useAuth();
  const { currency, rates } = useCurrency();
  const { showKurus } = useSettings();
  const showPrices = can("financial.view");

  const money = (value: number | null) =>
    value != null ? formatCurrency(value, currency, rates?.[currency] || 1, showKurus) : "-";

  return (
    <Card className="py-5 gap-3">
      <CardHeader className="px-5 pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
          <Receipt className="size-4 text-muted-foreground" />
          Geçmiş Satın Alımlar
          {entries.length > 0 && (
            <span className="ml-auto text-xs font-medium text-muted-foreground">
              {entries.length} kayıt
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pt-2">
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Bu ürün için kayıtlı satın alma bulunmuyor.
          </p>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              Her satır o günkü birim fiyatını korur; ürünün güncel fiyatını değiştirmek bu
              kayıtları etkilemez.
            </p>
            <div className="max-h-96 space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
              {entries.map((e) => (
                <div
                  key={e.itemId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/satin-alma/${e.purchaseOrderId}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {e.code}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.supplierName}
                      {purchaseDate(e) ? ` · ${formatDateShort(purchaseDate(e)!)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-right">
                    <div>
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {formatNumber(e.quantity)} {unit}
                      </p>
                      {showPrices && (
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {money(e.unitPrice)} × {formatNumber(e.quantity)} = {money(e.lineTotal)}
                        </p>
                      )}
                    </div>
                    {e.status && <PurchaseStatusBadge status={e.status} />}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
