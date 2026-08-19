"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, FileText, FileSignature, BadgeCheck, Undo2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Can } from "@/components/common/can";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAsync } from "@/lib/hooks/use-async";
import { useSettings } from "@/lib/settings-context";
import { useCurrency } from "@/lib/currency-context";
import { formatDate, formatDateShort, formatCurrency } from "@/lib/format";
import { listQuoteRequests, approveQuoteRequest, rejectQuoteRequest, type QuoteRequestRow } from "@/lib/api/quotes";
import { downloadQuoteRequestPdf } from "@/lib/export/quote-download";
import { ApiError } from "@/lib/api/client";

const QUOTE_STATUS_LABELS: Record<QuoteRequestRow["status"], string> = {
  pending_approval: "Onay Bekliyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
};

const QUOTE_STATUS_CLASSES: Record<QuoteRequestRow["status"], string> = {
  pending_approval: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-status-good/10 text-status-good border-status-good/30",
  rejected: "bg-status-critical/10 text-status-critical border-status-critical/30",
};

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// More rows to fit on a single page
const COMPACT_PAGE_SIZE = 15;

export function QuotesAndOrdersPanel({ refreshKey }: { refreshKey?: number }) {
  const { company, userProfile } = useSettings();
  const { currency, rates } = useCurrency();
  const rate = rates?.[currency] || 1;
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const { status, data, staleData, error, refetch } = useAsync(
    () => listQuoteRequests({ page, pageSize: COMPACT_PAGE_SIZE }),
    [page, refreshKey],
  );
  const view = data ?? staleData;

  const handleDownload = useCallback(async (row: QuoteRequestRow, lang: "tr" | "en") => {
    setDownloadingId(row.id);
    try {
      const approverName = `${userProfile.firstName} ${userProfile.lastName}`.trim();
      await downloadQuoteRequestPdf(row.id, company, approverName, lang);
      toast.success(lang === "tr" ? "Teklif PDF'i indirildi" : "Quote PDF downloaded");
    } catch {
      toast.error("PDF oluşturulamadı");
    } finally {
      setDownloadingId(null);
    }
  }, [company]);

  const handleDecision = useCallback(async (row: QuoteRequestRow, decision: "approve" | "reject") => {
    setDecidingId(row.id);
    try {
      await (decision === "approve" ? approveQuoteRequest(row.id) : rejectQuoteRequest(row.id));
      toast.success(decision === "approve" ? "Teklif onaylandı." : "Teklif reddedildi.");
      refetch();
    } catch (err) {
      toast.error(decision === "approve" ? "Teklif onaylanamadı" : "Teklif reddedilemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
    } finally {
      setDecidingId(null);
    }
  }, [refetch]);

  const columns = useMemo<ColumnDef<QuoteRequestRow, unknown>[]>(
    () => [
      {
        id: "type",
        accessorKey: "type",
        header: "Tür",
        meta: { className: "w-[6%] text-center py-1.5" },
        cell: () => (
          <div className="flex justify-center">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1 px-1.5 py-0">
              <FileSignature className="size-3" />
              Teklif
            </Badge>
          </div>
        ),
      },
      {
        id: "code",
        accessorKey: "code",
        header: "Belge No",
        meta: { className: "w-[12%] text-left py-1.5" },
        cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.code}</span>,
      },
      {
        id: "supplier",
        accessorKey: "supplierName",
        header: "Tedarikçi",
        enableSorting: false,
        meta: { className: "w-[14%] text-left py-1.5" },
        cell: ({ row }) => (
          <span className="block truncate text-sm" title={row.original.supplierName}>{row.original.supplierName}</span>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Durum",
        enableSorting: false,
        meta: { className: "w-[10%] text-center py-1.5" },
        cell: ({ row }) => (
          <div className="flex justify-center">
            <Badge variant="outline" className={`gap-1 px-1.5 py-0 ${QUOTE_STATUS_CLASSES[row.original.status]}`}>
              {QUOTE_STATUS_LABELS[row.original.status]}
            </Badge>
          </div>
        ),
      },
      {
        id: "itemCount",
        accessorKey: "itemCount",
        header: "Kalem",
        enableSorting: false,
        meta: { className: "w-[6%] text-center py-1.5" },
        cell: ({ row }) => <span className="tabular-nums flex justify-center text-sm">{row.original.itemCount}</span>,
      },
      {
        id: "total",
        accessorKey: "total",
        header: "Tutar",
        enableSorting: false,
        meta: { className: "w-[10%] text-center py-1.5" },
        cell: ({ row }) => {
          return <div className="text-center tabular-nums font-medium text-sm">{formatCurrency(row.original.total / rate, currency, 1, true)}</div>;
        }
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: "Oluşturma",
        enableSorting: false,
        meta: { className: "w-[10%] text-center py-1.5" },
        cell: ({ row }) => <div className="text-center tabular-nums text-muted-foreground text-xs">{formatDate(row.original.createdAt)}</div>,
      },
      {
        id: "createdBy",
        accessorKey: "createdBy",
        header: "Oluşturan",
        enableSorting: false,
        meta: { className: "w-[10%] text-center py-1.5" },
        cell: ({ row }) => <div className="text-center text-sm truncate block">{row.original.createdBy}</div>
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { className: "w-[22%] text-center py-1.5" },
        cell: ({ row }) => {
          const quote = row.original;
          return (
            <div className="flex justify-center items-center gap-1">
              <Can permission="purchase.approve">
                {quote.status === "pending_approval" && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-status-good hover:text-status-good"
                      disabled={decidingId === quote.id}
                      onClick={() => handleDecision(quote, "approve")}
                    >
                      <BadgeCheck className="size-3.5" />
                      Onayla
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-status-critical hover:text-status-critical"
                      disabled={decidingId === quote.id}
                      onClick={() => handleDecision(quote, "reject")}
                    >
                      <Undo2 className="size-3.5" />
                      Reddet
                    </Button>
                  </>
                )}
              </Can>
              {quote.status === "approved" && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        disabled={downloadingId === quote.id}
                      >
                        {downloadingId === quote.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Download className="size-3.5" />
                        )}
                        PDF İndir
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleDownload(quote, "tr")}>
                      Türkçe
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDownload(quote, "en")}>
                      İngilizce
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        },
      },
    ],
    [downloadingId, decidingId, handleDownload, handleDecision, currency, rate],
  );

  return (
    <DataTable
      columns={columns}
      data={view?.rows ?? []}
      total={view?.total ?? 0}
      page={page}
      pageSize={COMPACT_PAGE_SIZE}
      onPageChange={setPage}
      loading={!view}
      error={status === "error" && !view ? error : undefined}
      onRetry={refetch}
      isFiltered={false}
      emptyTitle="Kayıt bulunamadı"
      emptyDescription="Teklif istekleri burada listelenecek."
    />
  );
}
