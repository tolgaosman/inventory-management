"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ShoppingCart,
  AlertTriangle,
  Truck,
  Clock,
  Boxes,
  Wallet,
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Send,
  PackageCheck,
  Ban,
  Trash2,
  X,
  Download,
  FileSpreadsheet,
  FileText,
  FileSignature,
  Loader2,
  Hourglass,
  BadgeCheck,
  BadgeX,
  Undo2,
  XCircle,
  Share2,
} from "lucide-react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { PageHeader } from "@/components/common/page-header";
import { Can } from "@/components/common/can";
import { ForbiddenState } from "@/components/common/forbidden-state";
import { StatGrid } from "@/components/common/stat-card";
import { Section, SectionStack } from "@/components/common/section";
import { DataTableColumnFilter } from "@/components/data-table/data-table-filter";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/data-table/data-table";
import { PurchaseStatusBadge } from "@/components/common/status-badge";
import { PurchaseOrderFormSheet } from "@/components/purchase-orders/purchase-order-form-sheet";
import { PurchaseOrderReceiveSheet } from "@/components/purchase-orders/purchase-order-receive-sheet";
import { PurchaseCommandHero } from "@/components/purchase-orders/purchase-command-hero";

import { SupplierScorecardPanel } from "@/components/purchase-orders/supplier-scorecard-panel";
import { QuoteRequestDialog } from "@/components/purchase-orders/quote-request-dialog";
import { QuoteRequestFormSheet } from "@/components/purchase-orders/quote-request-form-sheet";
import { QuotesAndOrdersPanel } from "@/components/purchase-orders/quote-requests-panel";
import { ShareDraftDialog } from "./share-draft-dialog";
import { useAsync } from "@/lib/hooks/use-async";
import { useChangedSince } from "@/lib/hooks/use-reset-on-change";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import { useCurrency } from "@/lib/currency-context";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings-context";
import { getAvailableActions } from "@/lib/purchase-order-actions";
import { cn } from "@/lib/utils";
import {
  listPurchaseOrders,
  getPurchaseOrder,
  getPurchaseOrderStats,
  getSupplierScorecards,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  markPurchaseOrderOrdered,
  requestPurchaseOrderApproval,
  approvePurchaseOrder,
  rejectPurchaseOrderApproval,
  cancelPurchaseOrder,
  bulkMarkPurchaseOrdersOrdered,
  bulkCancelPurchaseOrders,
  bulkDeletePurchaseOrders,
  type PurchaseOrderQuery,
  type BulkOperationResult,
} from "@/lib/api/purchase-orders";
import { listSuppliers, listWarehouses } from "@/lib/api/catalog";
import { getProduct } from "@/lib/api/products";
import { ApiError } from "@/lib/api/client";
import { formatNumber, formatCurrency, formatDate, formatDateShort } from "@/lib/format";
import { PAGE_SIZE, PURCHASE_STATUS_LABELS } from "@/lib/constants";
import type { ReportData } from "@/lib/export/report-data";
import { buildReportExcel } from "@/lib/export/excel";
import { buildReportPdf } from "@/lib/export/pdf";
import { downloadBlob, reportFilename } from "@/lib/export/download";
import type { PurchaseOrderStatus } from "@/lib/types";

type PurchaseOrderRow = Awaited<ReturnType<typeof listPurchaseOrders>>["rows"][number];
type PurchaseOrderDetail = Awaited<ReturnType<typeof getPurchaseOrder>>;
type CommandTab = "orders" | "pending_approvals" | "my_drafts" | "scorecard" | "quotes";

const STATUS_OPTIONS: PurchaseOrderStatus[] = [
  "draft",
  "pending_approval",
  "ordered",
  "partially_received",
  "received",
  "cancelled",
];

function receiveProgress(row: PurchaseOrderRow): number {
  return row.orderedTotal > 0 ? Math.round((row.receivedTotal / row.orderedTotal) * 100) : 0;
}

export function PurchaseOrdersClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currency, rates } = useCurrency();
  const rate = rates?.[currency] || 1;
  const { name, can, user } = useAuth();
  const { company } = useSettings();

  const [tab, setTab] = useState<CommandTab>(() => {
    const fromUrl = searchParams.get("tab");
    return fromUrl === "scorecard" || fromUrl === "pending_approvals" ? fromUrl : "orders";
  });

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [status, setStatus] = useState<PurchaseOrderStatus | "all">(
    (searchParams.get("status") as PurchaseOrderStatus | null) ?? "all",
  );
  const [supplierId, setSupplierId] = useState(searchParams.get("supplierId") ?? "all");
  const [warehouseFilter, setWarehouseFilter] = useState(searchParams.get("warehouseId") ?? "all");
  const [priorityFilter, setPriorityFilter] = useState<"low" | "medium" | "high" | "all">(
    (searchParams.get("priority") as "low" | "medium" | "high" | "all") ?? "all"
  );
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkAction, setBulkAction] = useState<"cancel" | "delete" | null>(null);

  const [rejectingPo, setRejectingPo] = useState<PurchaseOrderRow | undefined>(undefined);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrderDetail | undefined>(undefined);
  const [initialItems, setInitialItems] = useState<{ productId: string; quantity: number; unitPrice: number }[] | undefined>(undefined);

  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrderDetail | undefined>(undefined);
  const [cancelling, setCancelling] = useState<PurchaseOrderRow | undefined>(undefined);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [deleting, setDeleting] = useState<PurchaseOrderRow | undefined>(undefined);
  const [sharingOrder, setSharingOrder] = useState<PurchaseOrderRow | undefined>(undefined);

  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quoteFormOpen, setQuoteFormOpen] = useState(false);
  const [quoteSelection, setQuoteSelection] = useState<{ supplierId: string; purchaseOrderIds: string[] } | undefined>(
    undefined,
  );
  const [quoteRefreshKey, setQuoteRefreshKey] = useState(0);

  const exportGuard = useSubmitGuard();

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const query: PurchaseOrderQuery = useMemo(
    () => ({
      search: search || undefined,
      status: tab === "pending_approvals" ? "pending_approval" : (status === "all" ? undefined : status),
      excludeStatus: tab === "orders" && status === "all" ? "pending_approval" : tab === "orders" ? "draft" : undefined,
      isMyDrafts: tab === "my_drafts",
      supplierId: supplierId === "all" ? undefined : supplierId,
      warehouseId: warehouseFilter === "all" ? undefined : warehouseFilter,
      priority: priorityFilter === "all" ? undefined : priorityFilter,
      page,
      pageSize: PAGE_SIZE,
      sortBy: sorting[0]?.id,
      sortDir: sorting[0]?.desc ? "desc" : "asc",
    }),
    [search, status, supplierId, warehouseFilter, priorityFilter, page, sorting, tab],
  );

  const filterKey = JSON.stringify({ search, status, supplierId, warehouseFilter, priorityFilter, sorting });
  if (useChangedSince(filterKey) && page !== 1) setPage(1);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (supplierId !== "all") params.set("supplierId", supplierId);
    if (warehouseFilter !== "all") params.set("warehouseId", warehouseFilter);
    if (priorityFilter !== "all") params.set("priority", priorityFilter);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `/satin-alma?${qs}` : "/satin-alma", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, supplierId, warehouseFilter, priorityFilter, page]);

  const { status: fetchStatus, data, staleData, error, refetch } = useAsync(
    () => listPurchaseOrders(query),
    [JSON.stringify(query)],
  );
  const view = data ?? staleData;

  const { data: refData } = useAsync(
    () => Promise.all([listSuppliers({ pageSize: 1000 }), listWarehouses()]),
    [],
  );
  const suppliers = refData?.[0]?.rows ?? [];
  const warehouses = refData?.[1] ?? [];

  const { data: stats, refetch: refetchStats } = useAsync(() => getPurchaseOrderStats(), []);

  const { data: scorecardData, status: scorecardStatus, refetch: refetchScorecards } = useAsync(
    () => getSupplierScorecards(),
    [],
  );
  const scorecards = scorecardData ?? [];

  function refetchAll() {
    refetch();
    refetchStats();
    refetchScorecards();
  }

  const isFiltered =
    Boolean(search) || status !== "all" || supplierId !== "all" || warehouseFilter !== "all" || priorityFilter !== "all";

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setStatus("all");
    setSupplierId("all");
    setWarehouseFilter("all");
    setPriorityFilter("all");
  }

  useEffect(() => {
    const single = searchParams.get("productId");
    const multi = searchParams.get("productIds");
    const ids = multi ? multi.split(",").filter(Boolean) : single ? [single] : [];
    if (ids.length === 0) return;

    let cancelled = false;
    Promise.all(ids.map((id) => getProduct(id).catch(() => undefined))).then((products) => {
      if (cancelled) return;
      const resolved = products.filter((p): p is NonNullable<typeof p> => Boolean(p));
      if (resolved.length === 0) return;
      setInitialItems(
        resolved.map((p) => ({
          productId: p.id,
          quantity: Math.max(1, p.minStock - p.totalStock),
          unitPrice: p.purchasePrice,
        })),
      );
      setEditingOrder(undefined);
      setFormOpen(true);
      router.replace("/satin-alma", { scroll: false });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goToOverdue() {
    setTab("orders");
    setStatus("all");
  }

  function goToDrafts() {
    setTab("orders");
    setStatus("draft");
  }
  function goToArrivingSoon() {
    setTab("orders");
    setStatus("all");
    setSorting([{ id: "expectedAt", desc: false }]);
  }

  async function openEdit(row: PurchaseOrderRow) {
    try {
      const full = await getPurchaseOrder(row.id);
      setInitialItems(undefined);
      setEditingOrder(full);
      setFormOpen(true);
    } catch (err) {
      toast.error("Sipariş yüklenemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
    }
  }

  async function openReceive(row: PurchaseOrderRow) {
    try {
      const full = await getPurchaseOrder(row.id);
      setReceivingOrder(full);
    } catch (err) {
      toast.error("Sipariş yüklenemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
    }
  }

  async function handleSaved(values: {
    supplierId: string;
    warehouseId: string;
    expectedAt: string;
    notes?: string;
    items: { productId: string; quantity: number; unitPrice: number }[];
  }) {
    try {
      if (editingOrder) {
        await updatePurchaseOrder(editingOrder.id, values);
      } else {
        await createPurchaseOrder(values);
      }
      refetchAll();
    } catch (err) {
      toast.error(editingOrder ? "Sipariş güncellenemedi" : "Sipariş oluşturulamadı", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
      throw err;
    }
  }

  async function handleMarkOrdered(row: PurchaseOrderRow) {
    try {
      await markPurchaseOrderOrdered(row.id);
      toast.success("Sipariş gönderildi.", { description: `${row.code} artık "Sipariş Edildi" durumunda.` });
      refetchAll();
    } catch (err) {
      toast.error("Sipariş gönderilemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
    }
  }

  async function handleRequestApproval(row: PurchaseOrderRow) {
    try {
      await requestPurchaseOrderApproval(row.id);
      toast.success("Sipariş onaya gönderildi.", { description: `${row.code} artık "Onay Bekliyor" durumunda.` });
      refetchAll();
    } catch (err) {
      toast.error("Sipariş onaya gönderilemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
    }
  }

  async function handleApprove(row: PurchaseOrderRow) {
    try {
      await approvePurchaseOrder(row.id);
      toast.success("Sipariş onaylandı.", { description: `${row.code} artık "Sipariş Edildi" durumunda.` });
      refetchAll();
    } catch (err) {
      toast.error("Sipariş onaylanamadı", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
    }
  }

  function handleReject(row: PurchaseOrderRow) {
    setRejectingPo(row);
    setRejectReason("");
  }

  async function submitReject() {
    if (!rejectingPo) return;
    if (!rejectReason.trim()) {
      toast.error("Lütfen bir reddetme gerekçesi girin.");
      return;
    }
    
    setIsRejecting(true);
    try {
      await rejectPurchaseOrderApproval(rejectingPo.id, rejectReason);
      toast.success("Onay reddedildi.", { description: `${rejectingPo.code} iptal edildi.` });
      setRejectingPo(undefined);
      setRejectReason("");
      refetchAll();
    } catch (err) {
      toast.error("Onay reddedilemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
    } finally {
      setIsRejecting(false);
    }
  }

  function openCancelDialog(row: PurchaseOrderRow) {
    setCancelling(row);
    setCancelReason("");
  }

  async function handleCancel() {
    if (!cancelling) return;
    if (!cancelReason.trim()) {
      toast.error("Lütfen bir iptal gerekçesi girin.");
      return;
    }

    setIsCancelling(true);
    try {
      await cancelPurchaseOrder(cancelling.id, cancelReason);
      toast.success("Sipariş iptal edildi.", { description: `${cancelling.code} iptal edildi.` });
      setCancelling(undefined);
      setCancelReason("");
      refetchAll();
    } catch (err) {
      toast.error("Sipariş iptal edilemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await deletePurchaseOrder(deleting.id);
      toast.success("Sipariş silindi.", { description: `${deleting.code} kaldırıldı.` });
      setDeleting(undefined);
      refetchAll();
    } catch (err) {
      toast.error("Sipariş silinemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
    }
  }

  function reportBulkResult(res: BulkOperationResult, verb: string) {
    if (res.successCount > 0) {
      toast.success(`${res.successCount} sipariş ${verb}.`, {
        description: res.failed.length > 0 ? `${res.failed.length} sipariş uygun durumda olmadığı için atlandı.` : undefined,
      });
    } else {
      toast.error("Hiçbir sipariş işlenemedi", { description: res.failed[0]?.reason ?? "Beklenmedik bir hata oluştu." });
    }
  }

  async function handleBulkMarkOrdered() {
    setBulkProcessing(true);
    try {
      const res = await bulkMarkPurchaseOrdersOrdered([...selectedIds]);
      reportBulkResult(res, "gönderildi");
      setSelectedIds(new Set());
      refetchAll();
    } finally {
      setBulkProcessing(false);
    }
  }

  async function confirmBulkAction() {
    if (!bulkAction) return;
    setBulkProcessing(true);
    try {
      const ids = [...selectedIds];
      const res = bulkAction === "cancel" ? await bulkCancelPurchaseOrders(ids) : await bulkDeletePurchaseOrders(ids);
      reportBulkResult(res, bulkAction === "cancel" ? "iptal edildi" : "silindi");
      setSelectedIds(new Set());
      setBulkAction(null);
      refetchAll();
    } finally {
      setBulkProcessing(false);
    }
  }

  async function handleExport(format: "excel" | "pdf", onlySelected?: boolean) {
    await exportGuard.guard(async () => {
      try {
        const all = await listPurchaseOrders({ ...query, page: 1, pageSize: 10000 });
        let rows = all.rows;
        const hasSelection = selectedIds.size > 0;
        if (hasSelection) {
          rows = rows.filter((r) => selectedIds.has(r.id));
        }

        const reportTitle = hasSelection ? `Seçili Siparişler (${rows.length} Adet)` : "Satın Alma Siparişleri";
        const report: ReportData = {
          company: company.companyName,
          title: reportTitle,
          generatedAt: new Date(),
          rangeLabel: "Tüm Zamanlar",
          generatedBy: name,
          currency,
          kpis: [],
          sections: [
            {
              title: reportTitle,
              columns: ["Sipariş No", "Tedarikçi", "Depo", "Durum", "Kalem", `Toplam`, "Sipariş Tarihi", "Beklenen Teslim"],
              numericColumns: [4, 5],
              currencyColumns: [5],
              emptyMessage: "Sipariş bulunamadı.",
              rows: rows.map((r) => [
                r.code,
                r.supplierName,
                r.warehouseName,
                PURCHASE_STATUS_LABELS[r.status],
                r.itemCount,
                r.total / rate,
                formatDateShort(r.createdAt),
                formatDateShort(r.expectedAt),
              ]),
            },
          ],
        };

        const ext = format === "excel" ? "xlsx" : "pdf";
        const date = new Date();
        const filenamePrefix = onlySelected ? "secili-siparisler" : "satin-alma-siparisleri";
        if (format === "excel") {
          downloadBlob(buildReportExcel(report, ["all"]), reportFilename(ext, date, filenamePrefix));
          toast.success("Excel raporu indirildi", { description: `${rows.length} sipariş dışa aktarıldı.` });
        } else {
          downloadBlob(await buildReportPdf(report, ["all"]), reportFilename(ext, date, filenamePrefix));
          toast.success("PDF raporu indirildi", { description: `${rows.length} sipariş dışa aktarıldı.` });
        }
      } catch {
        toast.error(format === "excel" ? "Excel oluşturulamadı" : "PDF oluşturulamadı");
      }
    });
  }

  const columns = useMemo<ColumnDef<PurchaseOrderRow, unknown>[]>(
    () => [
      {
        id: "select",
        header: () => {
          const pageRows = view?.rows ?? [];
          const allSelected = pageRows.length > 0 && pageRows.every((r) => selectedIds.has(r.id));
          return (
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (checked) pageRows.forEach((r) => next.add(r.id));
                  else pageRows.forEach((r) => next.delete(r.id));
                  return next;
                });
              }}
              aria-label="Tümünü seç"
            />
          );
        },
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.has(row.original.id)}
            onCheckedChange={(checked) => {
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (checked) next.add(row.original.id);
                else next.delete(row.original.id);
                return next;
              });
            }}
            aria-label="Sipariş seç"
          />
        ),
        enableSorting: false,
        meta: { className: "w-10 text-center" },
      },
      {
        id: "code",
        accessorKey: "code",
        header: "Sipariş No",
        meta: { className: "w-[12%] text-left" },
        cell: ({ row }) => (
          <Link
            href={`/satin-alma/${row.original.id}`}
            className="block truncate font-mono text-xs font-semibold text-foreground hover:text-primary transition-colors"
            title={row.original.code}
          >
            {row.original.code}
          </Link>
        ),
      },
      {
        id: "supplier",
        accessorKey: "supplierName",
        header: "Tedarikçi",
        enableSorting: false,
        meta: { 
          className: "w-[14%] text-center",
          filterElement: (
            <DataTableColumnFilter
              value={supplierId}
              onValueChange={setSupplierId}
              options={suppliers.map((s) => ({ label: s.name, value: s.id }))}
              title="Tedarikçi Seç"
            />
          )
        },
        cell: ({ row }) => (
          <span className="block truncate text-center" title={row.original.supplierName}>{row.original.supplierName}</span>
        ),
      },
      {
        id: "warehouse",
        accessorKey: "warehouseName",
        header: "Depo",
        enableSorting: false,
        meta: {
          className: "w-[12%] text-center",
          filterElement: (
            <DataTableColumnFilter
              value={warehouseFilter}
              onValueChange={setWarehouseFilter}
              options={warehouses.map((w) => ({ label: w.name, value: w.id }))}
              title="Depo Seç"
            />
          )
        },
        cell: ({ row }) => (
          <span className="block truncate text-muted-foreground text-xs text-center">{row.original.warehouseName}</span>
        )
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Durum",
        enableSorting: false,
        meta: { 
          className: "w-[12%] text-center",
          filterElement: (
            <DataTableColumnFilter
              value={status}
              onValueChange={(v) => setStatus(v as any)}
              options={STATUS_OPTIONS.map((s) => ({ label: PURCHASE_STATUS_LABELS[s], value: s }))}
              title="Durum"
            />
          )
        },
        cell: ({ row }) => (
          <div className="flex justify-center">
            <PurchaseStatusBadge status={row.original.status} rejectionReason={row.original.rejectionReason} />
          </div>
        ),
      },
      {
        id: "priority",
        accessorKey: "priority",
        header: "Öncelik",
        enableSorting: false,
        meta: { 
          className: "w-[8%] text-center",
          filterElement: (
            <DataTableColumnFilter
              value={priorityFilter}
              onValueChange={(v) => setPriorityFilter(v as any)}
              options={[
                { label: "Yüksek", value: "high" },
                { label: "Orta", value: "medium" },
                { label: "Düşük", value: "low" }
              ]}
              title="Öncelik"
            />
          )
        },
        cell: ({ row }) => {
          const p = row.original.priority;
          const label = p === "high" ? "Yüksek" : p === "medium" ? "Orta" : "Düşük";
          const variant = p === "high" ? "destructive" : p === "medium" ? "secondary" : "outline";
          return (
            <div className="flex justify-center">
              <Badge variant={variant} className="capitalize">
                {label}
              </Badge>
            </div>
          );
        },
      },
      {
        id: "itemCount",
        accessorKey: "itemCount",
        header: "Kalem",
        enableSorting: false,
        meta: { className: "w-[7%] text-center" },
        cell: ({ row }) => <span className="tabular-nums flex justify-center">{row.original.itemCount}</span>,
      },
      {
        id: "progress",
        header: "Teslim İlerlemesi",
        enableSorting: false,
        meta: { className: "w-[14%] text-center" },
        cell: ({ row }) => {
          const percent = receiveProgress(row.original);
          return (
            <div className="flex flex-col items-center gap-1">
              <Progress value={percent} className="h-1.5 w-full max-w-24">
                <ProgressTrack className="h-1.5">
                  <ProgressIndicator />
                </ProgressTrack>
              </Progress>
              <span className="text-micro tabular-nums text-muted-foreground">%{percent}</span>
            </div>
          );
        },
      },
      {
        id: "total",
        accessorKey: "total",
        header: "Toplam",
        meta: { className: "w-[12%] text-center" },
        cell: ({ row }) => (
          <span className="tabular-nums font-semibold flex justify-center">
            {formatCurrency(row.original.total / rate, currency, 1, true)}
          </span>
        ),
      },
      {
        id: "expectedAt",
        accessorKey: "expectedAt",
        header: "Beklenen Teslim",
        meta: { className: "w-[10%] text-center" },
        cell: ({ row }) => {
          const overdue =
            row.original.status !== "received" &&
            row.original.status !== "cancelled" &&
            row.original.expectedAt < new Date().toISOString();
          return (
            <span className={cn(overdue ? "tabular-nums font-medium text-status-critical" : "tabular-nums text-muted-foreground", "flex justify-center")}>
              {formatDate(row.original.expectedAt)}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { className: tab === "pending_approvals" && can("purchase.approve") ? "w-28 pr-5 text-right" : "w-16 pr-5 text-right" },
        cell: ({ row }) => {
          const po = row.original;
          const actions = getAvailableActions({ status: po.status, hasReceivedProgress: po.receivedTotal > 0 });
          return (
            <div className="flex items-center justify-end gap-0.5">
              {tab === "pending_approvals" && can("purchase.approve") && (
                <>
                  <Button variant="ghost" size="icon" className="size-8 text-status-good hover:text-status-good/80 hover:bg-status-good/10" onClick={() => handleApprove(po)} title="Onayla">
                    <BadgeCheck className="size-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 text-status-critical hover:text-status-critical/80 hover:bg-status-critical/10" onClick={() => handleReject(po)} title="Reddet">
                    <BadgeX className="size-5" />
                  </Button>
                </>
              )}
              <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" className="size-8">
                    <MoreHorizontal className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem render={<Link href={`/satin-alma/${po.id}`} />}>
                  <Eye className="size-4" />
                  Detay Göster
                </DropdownMenuItem>
                {(actions.canMarkOrdered ||
                  actions.canRequestApproval ||
                  actions.canApprove ||
                  actions.canReject ||
                  actions.canEdit ||
                  actions.canReceive ||
                  actions.canCancel ||
                  actions.canDelete) &&
                  (can("purchase.manage") || can("purchase.receive")) && <DropdownMenuSeparator />}
                {actions.canMarkOrdered && can("purchase.approve") && (
                  <DropdownMenuItem onClick={() => handleMarkOrdered(po)}>
                    <Send className="size-4" />
                    Siparişi Gönder
                  </DropdownMenuItem>
                )}
                <Can permission="purchase.manage">
                  <>
                    {actions.canRequestApproval && (
                      <DropdownMenuItem onClick={() => handleRequestApproval(po)}>
                        <Hourglass className="size-4" />
                        Onaya Gönder
                      </DropdownMenuItem>
                    )}
                  </>
                </Can>
                {actions.canApprove && can("purchase.approve") && tab !== "pending_approvals" && (
                  <DropdownMenuItem onClick={() => handleApprove(po)}>
                    <BadgeCheck className="size-4" />
                    Siparişi Onayla
                  </DropdownMenuItem>
                )}
                {actions.canReject && can("purchase.approve") && tab !== "pending_approvals" && (
                  <DropdownMenuItem onClick={() => handleReject(po)}>
                    <Undo2 className="size-4" />
                    Siparişi Reddet
                  </DropdownMenuItem>
                )}
                <Can permission="purchase.manage">
                  <>
                    {actions.canEdit && (
                      <DropdownMenuItem onClick={() => openEdit(po)}>
                        <Pencil className="size-4" />
                        Düzenle
                      </DropdownMenuItem>
                    )}
                    {po.status === "draft" && po.createdById === user?.id && (
                      <DropdownMenuItem onClick={() => setSharingOrder(po)}>
                        <Share2 className="size-4" />
                        Paylaşıma Aç
                      </DropdownMenuItem>
                    )}
                  </>
                </Can>
                {actions.canReceive && (can("purchase.manage") || can("purchase.receive")) && (
                  <DropdownMenuItem onClick={() => openReceive(po)}>
                    <PackageCheck className="size-4" />
                    Teslim Al
                  </DropdownMenuItem>
                )}
                {actions.canCancel && can("purchase.manage") && (
                  <DropdownMenuItem onClick={() => openCancelDialog(po)}>
                    <XCircle className="size-4" />
                    İptal Et
                  </DropdownMenuItem>
                )}
                <Can permission="purchase.approve">
                  <>
                    {actions.canDelete && (
                      <DropdownMenuItem variant="destructive" onClick={() => setDeleting(po)}>
                        <Trash2 className="size-4" />
                        Sil
                      </DropdownMenuItem>
                    )}
                  </>
                </Can>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [selectedIds, view, currency, rates, handleMarkOrdered, handleRequestApproval, handleApprove, handleReject, can, tab, user?.id],
  ).filter((col) => {
    if (col.id === "total" && !can("financial.view")) return false;
    if (col.id === "progress" && tab === "pending_approvals") return false;
    return true;
  });

  return (
    <Can permission="purchase.view" fallback={<Forbidden />}>
      <div className="space-y-6">
        <PageHeader
          title="Satın Alma"
          description="Siparişleri, ikmal ihtiyacını ve tedarikçi performansını tek yerden yönetin."
          actions={
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm" disabled={exportGuard.pending}>
                      {exportGuard.pending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                      Dışa Aktar
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("excel")}>
                    <FileSpreadsheet className="size-4 text-status-good" /> Excel (.xlsx)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Can permission="purchase.manage">
                <Button
                  size="sm"
                  disabled={(stats?.draftCount ?? 0) + (stats?.pendingApprovalCount ?? 0) === 0}
                  onClick={() => setQuoteDialogOpen(true)}
                >
                  <FileSignature className="size-4" />
                  Teklif Formu
                </Button>
              </Can>
              <Can permission="purchase.manage">
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingOrder(undefined);
                    setInitialItems(undefined);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  Yeni Sipariş
                </Button>
              </Can>
            </div>
          }
        />

        <PurchaseCommandHero
          stats={stats}
          currency={currency}
          rate={rate}
          onOverdueClick={goToOverdue}
          onDraftClick={goToDrafts}
          onArrivingClick={goToArrivingSoon}
        />

        <Tabs value={tab} onValueChange={(v) => setTab(v as CommandTab)} className="gap-4">
          <TabsList variant="line" className="w-full justify-start overflow-x-auto custom-scrollbar sm:w-fit">
            <TabsTrigger value="orders">
              <ShoppingCart className="size-4" />
              Siparişler
            </TabsTrigger>
            {user?.role === "satinalma" && (
              <TabsTrigger value="my_drafts">
                <FileSignature className="size-4" />
                Taslaklarım
              </TabsTrigger>
            )}
            {can("purchase.manage") && (
              <TabsTrigger value="pending_approvals">
                <BadgeCheck className="size-4" />
                Onay Bekleyenler
                {stats?.pendingApprovalCount ? (
                  <Badge variant="secondary" className="ml-1 px-1.5 text-micro">
                    {stats.pendingApprovalCount}
                  </Badge>
                ) : null}
              </TabsTrigger>
            )}
            <TabsTrigger value="scorecard">
              <Truck className="size-4" />
              Tedarikçi Karnesi
            </TabsTrigger>
            {can("purchase.manage") && (
              <TabsTrigger value="quotes">
                <FileSignature className="size-4" />
                Teklifler
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="orders">
            <SectionStack className={fetchStatus === "loading" ? "opacity-60 transition-opacity" : "transition-opacity"}>
              <Section index={0}>
                <StatGrid
                  className="grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                  items={[
                    { icon: ShoppingCart, tint: "blue", label: "Toplam Sipariş", value: formatNumber(stats?.totalOrders ?? 0) },
                    { icon: Clock, tint: "amber", label: "Açık Sipariş", value: formatNumber(stats?.openOrders ?? 0) },
                    { icon: Boxes, tint: "teal", label: "Bekleyen Adet", value: formatNumber(stats?.pendingUnits ?? 0) },
                    {
                      icon: Wallet,
                      tint: "green",
                      label: "Toplam Değer",
                      value: formatCurrency((stats?.totalValue ?? 0) / rate, currency, 1, true),
                    },
                  ]}
                />
              </Section>

              <Section index={1}>
                <Card>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative min-w-[220px] flex-1">
                        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                          placeholder="Sipariş no veya tedarikçi ara…"
                          className="h-9 pl-8"
                        />
                      </div>
                      {isFiltered && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
                          <X className="size-4" />
                          Temizle
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Section>

              {selectedIds.size > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 shadow-soft animate-in fade-in slide-in-from-top-1 duration-200 dark:bg-primary/15">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Badge variant="secondary" className="bg-primary px-2 py-0.5 font-semibold text-primary-foreground">
                      {selectedIds.size}
                    </Badge>
                    <span>Sipariş Seçildi</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Can permission="purchase.approve">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleBulkMarkOrdered}
                        disabled={bulkProcessing}
                        className="h-8 gap-1 border-primary text-xs text-primary hover:bg-primary/10"
                      >
                        <Send className="size-3.5" />
                        Toplu Gönder
                      </Button>
                    </Can>
                    <Can permission="purchase.manage">
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setBulkAction("cancel")}
                          disabled={bulkProcessing}
                          className="h-8 gap-1 border-status-warning/30 text-xs text-status-warning-foreground hover:bg-status-warning/10"
                        >
                          <Ban className="size-3.5" />
                          Toplu İptal
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setBulkAction("delete")}
                          disabled={bulkProcessing}
                          className="h-8 gap-1 text-xs"
                        >
                          <Trash2 className="size-3.5" />
                          Toplu Sil
                        </Button>
                      </>
                    </Can>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedIds(new Set())}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Seçimi Temizle
                    </Button>
                  </div>
                </div>
              )}

              <Section index={2}>
                <DataTable
                  columns={columns}
                  data={view?.rows ?? []}
                  total={view?.total ?? 0}
                  page={page}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                  loading={!view}
                  error={fetchStatus === "error" && !view ? error : undefined}
                  onRetry={refetch}
                  sorting={sorting}
                  onSortingChange={setSorting}
                  isFiltered={isFiltered}
                  emptyTitle="Henüz sipariş yok"
                  emptyDescription="Sisteme henüz bir satın alma siparişi eklenmemiş."
                />
              </Section>
            </SectionStack>
          </TabsContent>

          {can("purchase.manage") && (
            <TabsContent value="pending_approvals">
              <SectionStack className={fetchStatus === "loading" ? "opacity-60 transition-opacity" : "transition-opacity"}>
                <Section index={0}>
                  <DataTable
                    columns={columns}
                    data={view?.rows ?? []}
                    total={view?.total ?? 0}
                    page={page}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                    loading={!view}
                    error={fetchStatus === "error" && !view ? error : undefined}
                    onRetry={refetch}
                    sorting={sorting}
                    onSortingChange={setSorting}
                    isFiltered={false}
                    emptyTitle="Onay bekleyen sipariş yok"
                    emptyDescription="Şu anda onayınızı bekleyen herhangi bir satın alma siparişi bulunmuyor."
                  />
                </Section>
              </SectionStack>
            </TabsContent>
          )}

          {user?.role === "satinalma" && (
            <TabsContent value="my_drafts">
              <SectionStack className={fetchStatus === "loading" ? "opacity-60 transition-opacity" : "transition-opacity"}>
                <Section index={0}>
                  <DataTable
                    columns={columns}
                    data={view?.rows ?? []}
                    total={view?.total ?? 0}
                    page={page}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                    loading={!view}
                    error={fetchStatus === "error" && !view ? error : undefined}
                    onRetry={refetch}
                    sorting={sorting}
                    onSortingChange={setSorting}
                    isFiltered={false}
                    emptyTitle="Taslağınız bulunmuyor"
                    emptyDescription="Henüz oluşturduğunuz bir taslak sipariş yok."
                  />
                </Section>
              </SectionStack>
            </TabsContent>
          )}

          <TabsContent value="scorecard">
            <SupplierScorecardPanel
              scorecards={scorecards}
              loading={scorecardStatus === "loading" && scorecards.length === 0}
              currency={currency}
              rate={rate}
            />
          </TabsContent>

          {can("purchase.manage") && (
            <TabsContent value="quotes">
              <QuotesAndOrdersPanel refreshKey={quoteRefreshKey} />
            </TabsContent>
          )}
        </Tabs>

        <PurchaseOrderFormSheet
          open={formOpen}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) setInitialItems(undefined);
          }}
          order={editingOrder}
          initialItems={initialItems}
          suppliers={suppliers}
          warehouses={warehouses}
          onSaved={handleSaved}
        />

        <PurchaseOrderReceiveSheet
          open={Boolean(receivingOrder)}
          onOpenChange={(open) => !open && setReceivingOrder(undefined)}
          order={receivingOrder}
          warehouseName={receivingOrder ? warehouses.find((w) => w.id === receivingOrder.warehouseId)?.name : undefined}
          onDone={refetchAll}
        />

        {sharingOrder && (
          <ShareDraftDialog
            open={!!sharingOrder}
            onOpenChange={(open: boolean) => !open && setSharingOrder(undefined)}
            orderId={sharingOrder.id}
            initialSharedWith={sharingOrder.sharedWith ?? []}
            onDone={refetchAll}
          />
        )}

        <QuoteRequestDialog
          open={quoteDialogOpen}
          onOpenChange={setQuoteDialogOpen}
          suppliers={suppliers}
          onContinue={(selection) => {
            setQuoteSelection(selection);
            setQuoteDialogOpen(false);
            setQuoteFormOpen(true);
          }}
        />

        <QuoteRequestFormSheet
          open={quoteFormOpen}
          onOpenChange={setQuoteFormOpen}
          supplier={suppliers.find((s) => s.id === quoteSelection?.supplierId)}
          purchaseOrderIds={quoteSelection?.purchaseOrderIds ?? []}
          onCreated={() => {
            refetchAll();
            setQuoteRefreshKey((k) => k + 1);
          }}
        />

        <Dialog open={!!cancelling} onOpenChange={(open) => !open && setCancelling(undefined)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Siparişi İptal Et</DialogTitle>
              <DialogDescription>
                Bu siparişi iptal etmek istediğinize emin misiniz? Teslim alınmış ürünler iptal edilemez. Bu işlem geri alınamaz.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="cancel-reason">İptal Gerekçesi</Label>
                <Textarea
                  id="cancel-reason"
                  placeholder="İptal sebebini buraya yazın..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelling(undefined)}>Vazgeç</Button>
              <Button variant="destructive-solid" onClick={handleCancel} disabled={isCancelling}>
                {isCancelling ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                İptal Et
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(undefined)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Siparişi sil</AlertDialogTitle>
              <AlertDialogDescription>
                {deleting ? `"${deleting.code}" kalıcı olarak silinecek. Bu işlem geri alınamaz.` : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Vazgeç</AlertDialogCancel>
              <AlertDialogAction variant="destructive-solid" onClick={handleDelete}>
                Sil
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={!!rejectingPo} onOpenChange={(open) => !open && setRejectingPo(undefined)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Siparişi Reddet</DialogTitle>
              <DialogDescription>
                Lütfen bu siparişi neden reddettiğinizi kısaca belirtin.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="reason">Reddetme Gerekçesi</Label>
                <Textarea
                  id="reason"
                  placeholder="Reddetme sebebini buraya yazın..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectingPo(undefined)}>Vazgeç</Button>
              <Button variant="destructive-solid" onClick={submitReject} disabled={isRejecting}>
                {isRejecting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Reddet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={bulkAction !== null} onOpenChange={(open) => !open && setBulkAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{bulkAction === "cancel" ? "Seçili siparişleri iptal et" : "Seçili siparişleri sil"}</AlertDialogTitle>
              <AlertDialogDescription>
                {`${selectedIds.size} sipariş ${bulkAction === "cancel" ? "iptal edilecek" : "kalıcı olarak silinecek"}. Uygun olmayan siparişler atlanacak. Bu işlem geri alınamaz.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Vazgeç</AlertDialogCancel>
              <AlertDialogAction variant="destructive-solid" onClick={confirmBulkAction}>
                {bulkAction === "cancel" ? "İptal Et" : "Sil"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Can>
  );
}

function Forbidden() {
  return (
    <div className="space-y-6">
      <PageHeader title="Satın Alma" />
      <ForbiddenState message="Satın alma siparişlerini görüntülemek için yetkiniz yok." />
    </div>
  );
}
