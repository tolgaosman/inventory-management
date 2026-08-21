"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, FileText, FileSignature, BadgeCheck, Undo2, Mail, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Can } from "@/components/common/can";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAsync } from "@/lib/hooks/use-async";
import { useSettings } from "@/lib/settings-context";
import { formatDate, formatDateShort } from "@/lib/format";
import { listQuoteRequests, approveQuoteRequest, rejectQuoteRequest, deleteQuoteRequest, type QuoteRequestRow } from "@/lib/api/quotes";
import { downloadQuoteRequestPdf } from "@/lib/export/quote-download";
import { ApiError } from "@/lib/api/client";
import { QuoteSendEmailDialog } from "@/components/purchase-orders/quote-send-email-dialog";

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

export function QuotesAndOrdersPanel({
  refreshKey,
  /** "pending_approval" scopes to just what still needs a decision; "decided" excludes it (approved/rejected only). Omit for everything. */
  statusFilter,
}: {
  refreshKey?: number;
  statusFilter?: "pending_approval" | "decided";
}) {
  const { company, userProfile } = useSettings();
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [sendingQuote, setSendingQuote] = useState<QuoteRequestRow | null>(null);
  const [deletingQuote, setDeletingQuote] = useState<QuoteRequestRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { status, data, staleData, error, refetch } = useAsync(
    () =>
      listQuoteRequests({
        page,
        pageSize: COMPACT_PAGE_SIZE,
        status: statusFilter === "pending_approval" ? "pending_approval" : undefined,
        excludeStatus: statusFilter === "decided" ? "pending_approval" : undefined,
      }),
    [page, refreshKey, statusFilter],
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

  const handleDelete = useCallback(async () => {
    if (!deletingQuote) return;
    setDeleting(true);
    try {
      await deleteQuoteRequest(deletingQuote.id);
      toast.success("Teklif silindi.");
      setDeletingQuote(null);
      refetch();
    } catch (err) {
      toast.error("Teklif silinemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
    } finally {
      setDeleting(false);
    }
  }, [deletingQuote, refetch]);

  const columns = useMemo<ColumnDef<QuoteRequestRow, unknown>[]>(
    () => [
      {
        id: "type",
        accessorKey: "type",
        header: "Tür",
        meta: { className: "w-[10%] text-center py-1.5" },
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
        meta: { className: "w-[20%] text-left py-1.5" },
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
        meta: { className: "w-[8%] text-center py-1.5" },
        cell: ({ row }) => <span className="tabular-nums flex justify-center text-sm">{row.original.itemCount}</span>,
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
        meta: { className: "w-[12%] text-center py-1.5" },
        cell: ({ row }) => <div className="text-center text-sm truncate block">{row.original.createdBy}</div>
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { className: "w-[15%] text-center py-1.5" },
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
                <>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => setSendingQuote(quote)}
                  >
                    <Mail className="size-3.5" />
                    Gönder
                  </Button>
                </>
              )}
              <Can permission="purchase.approve">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => setDeletingQuote(quote)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </Can>
            </div>
          );
        },
      },
    ],
    [downloadingId, decidingId, handleDownload, handleDecision],
  );

  return (
    <>
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
      <QuoteSendEmailDialog
        open={sendingQuote !== null}
        onOpenChange={(open) => !open && setSendingQuote(null)}
        quote={sendingQuote}
      />
      <AlertDialog open={deletingQuote !== null} onOpenChange={(open) => !open && setDeletingQuote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Teklifi sil</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingQuote?.code} numaralı teklifi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction variant="destructive-solid" disabled={deleting} onClick={handleDelete}>
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
