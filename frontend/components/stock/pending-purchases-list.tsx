"use client";

import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { PanelCard } from "@/components/common/panel-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { PurchaseStatusBadge } from "@/components/common/status-badge";
import { useAsync } from "@/lib/hooks/use-async";
import { getPendingReceiptOrders } from "@/lib/api/purchase-orders";
import { receivePercent } from "@/lib/purchase-order-actions";
import { formatNumber } from "@/lib/format";

/**
 * Read-only list of purchase orders still awaiting (full) receipt — invoice
 * already uploaded, status "ordered"/"partially_received". Each row links
 * back to this same page with `?purchaseOrderId=`, which
 * `StockEntryForm` picks up to auto-check "Bu bir satın alım teslimatı" and
 * preselect that order — same deep link the notification bell uses.
 */
export function PendingPurchasesList({
  className,
  /** Renders just the table/empty-state, no PanelCard shell — for embedding inside a tabbed panel that already provides one. */
  noCard,
}: {
  className?: string;
  noCard?: boolean;
}) {
  const { data: orders, staleData } = useAsync(() => getPendingReceiptOrders(), []);
  const view = orders ?? staleData ?? [];

  const content =
    view.length === 0 ? (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground py-8">
        Teslim alınmayı bekleyen satın alım yok.
      </div>
    ) : (
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/70 hover:bg-transparent">
              <TableHead className="px-2">Sipariş</TableHead>
              <TableHead className="px-2">Durum</TableHead>
              <TableHead className="px-2 text-right">Teslim İlerlemesi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.map((order) => {
              const percent = receivePercent(order.receivedTotal, order.orderedTotal);
              return (
                <TableRow key={order.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <TableCell className="px-2">
                    <Link
                      href={`/stok/islem?purchaseOrderId=${order.id}`}
                      className="block min-w-0 hover:underline"
                    >
                      <p className="truncate text-xs sm:text-sm font-semibold text-foreground">{order.code}</p>
                      <p className="truncate text-micro text-muted-foreground">
                        {order.supplierName} · {order.warehouseName}
                      </p>
                    </Link>
                  </TableCell>
                  <TableCell className="px-2">
                    <PurchaseStatusBadge status={order.status} />
                  </TableCell>
                  <TableCell className="px-2">
                    <div className="flex flex-col items-end gap-1">
                      <Progress value={percent} className="h-1.5 w-full max-w-24">
                        <ProgressTrack className="h-1.5">
                          <ProgressIndicator />
                        </ProgressTrack>
                      </Progress>
                      <span className="text-micro tabular-nums text-muted-foreground">%{percent}</span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );

  if (noCard) {
    return content;
  }

  return (
    <PanelCard
      className={className}
      title={
        <span className="flex items-center gap-2">
          <PackageCheck className="size-4 text-muted-foreground" />
          Bekleyen Satın Alımlar
        </span>
      }
      meta={view.length > 0 ? formatNumber(view.length) : undefined}
      bodyClassName="flex flex-col"
    >
      {content}
    </PanelCard>
  );
}
