"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, FileText, FileSignature } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAsync } from "@/lib/hooks/use-async";
import { useSettings } from "@/lib/settings-context";
import { useCurrency } from "@/lib/currency-context";
import { formatDate, formatDateShort, formatCurrency } from "@/lib/format";
import { listQuoteRequests, type QuoteRequestRow } from "@/lib/api/quotes";
import { downloadQuoteRequestPdf } from "@/lib/export/quote-download";

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

  const columns = useMemo<ColumnDef<QuoteRequestRow, unknown>[]>(
    () => [
      {
        id: "type",
        accessorKey: "type",
        header: "Tür",
        meta: { className: "w-[8%] text-center py-1.5" },
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
        meta: { className: "w-[15%] text-left py-1.5" },
        cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.code}</span>,
      },
      {
        id: "supplier",
        accessorKey: "supplierName",
        header: "Tedarikçi",
        enableSorting: false,
        meta: { className: "w-[18%] text-left py-1.5" },
        cell: ({ row }) => (
          <span className="block truncate text-sm" title={row.original.supplierName}>{row.original.supplierName}</span>
        ),
      },
      {
        id: "itemCount",
        accessorKey: "itemCount",
        header: "Kalem",
        enableSorting: false,
        meta: { className: "w-[8%] text-center py-1.5" },
        cell: ({ row }) => <span className="tabular-nums flex justify-center text-sm">{row.original.itemCount}</span>,
      },
      {
        id: "total",
        accessorKey: "total",
        header: "Tutar",
        enableSorting: false,
        meta: { className: "w-[12%] text-center py-1.5" },
        cell: ({ row }) => {
          return <div className="text-center tabular-nums font-medium text-sm">{formatCurrency(row.original.total / rate, currency, 1, true)}</div>;
        }
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: "Oluşturma",
        enableSorting: false,
        meta: { className: "w-[12%] text-center py-1.5" },
        cell: ({ row }) => <div className="text-center tabular-nums text-muted-foreground text-xs">{formatDate(row.original.createdAt)}</div>,
      },
      {
        id: "createdBy",
        accessorKey: "createdBy",
        header: "Oluşturan",
        enableSorting: false,
        meta: { className: "w-[12%] text-center py-1.5" },
        cell: ({ row }) => <div className="text-center text-sm truncate block">{row.original.createdBy}</div>
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { className: "w-[15%] text-center py-1.5" },
        cell: ({ row }) => {
          return (
            <div className="flex justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      disabled={downloadingId === row.original.id}
                    >
                      {downloadingId === row.original.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Download className="size-3.5" />
                      )}
                      PDF İndir
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleDownload(row.original, "tr")}>
                    Türkçe
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownload(row.original, "en")}>
                    İngilizce
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [downloadingId, handleDownload, currency, rate],
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
