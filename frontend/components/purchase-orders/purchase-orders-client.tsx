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
  Loader2,
} from "lucide-react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { PageHeader } from "@/components/common/page-header";
import { Can } from "@/components/common/can";
import { ForbiddenState } from "@/components/common/forbidden-state";
import { StatGrid } from "@/components/common/stat-card";
import { Section, SectionStack } from "@/components/common/section";
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
import { DataTable } from "@/components/data-table/data-table";
import { PurchaseStatusBadge } from "@/components/common/status-badge";
import { PurchaseOrderFormSheet } from "@/components/purchase-orders/purchase-order-form-sheet";
import { PurchaseOrderReceiveSheet } from "@/components/purchase-orders/purchase-order-receive-sheet";
import { PurchaseCommandHero } from "@/components/purchase-orders/purchase-command-hero";
import { ReplenishmentPanel } from "@/components/purchase-orders/replenishment-panel";
import { ReplenishmentOrderDialog } from "@/components/purchase-orders/replenishment-order-dialog";
import { SupplierScorecardPanel } from "@/components/purchase-orders/supplier-scorecard-panel";
import { useAsync } from "@/lib/hooks/use-async";
import { useChangedSince } from "@/lib/hooks/use-reset-on-change";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import { useCurrency } from "@/lib/currency-context";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings-context";
import { getAvailableActions } from "@/lib/purchase-order-actions";
import {
  listPurchaseOrders,
  getPurchaseOrder,
  getPurchaseOrderStats,
  getReplenishmentSuggestions,
  getSupplierScorecards,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  markPurchaseOrderOrdered,
  cancelPurchaseOrder,
  createPurchaseOrdersFromSuggestions,
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
type CommandTab = "orders" | "replenishment" | "scorecard";

const STATUS_OPTIONS: PurchaseOrderStatus[] = ["draft", "ordered", "partially_received", "received", "cancelled"];

function receiveProgress(row: PurchaseOrderRow): number {
  return row.orderedTotal > 0 ? Math.round((row.receivedTotal / row.orderedTotal) * 100) : 0;
}

export function PurchaseOrdersClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currency, rates } = useCurrency();
  const rate = rates?.[currency] || 1;
  const { name } = useAuth();
  const { company } = useSettings();

  const [tab, setTab] = useState<CommandTab>(() => {
    const fromUrl = searchParams.get("tab");
    return fromUrl === "replenishment" || fromUrl === "scorecard" ? fromUrl : "orders";
  });

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [status, setStatus] = useState<PurchaseOrderStatus | "all">(
    (searchParams.get("status") as PurchaseOrderStatus | null) ?? "all",
  );
  const [supplierId, setSupplierId] = useState(searchParams.get("supplierId") ?? "all");
  const [warehouseFilter, setWarehouseFilter] = useState(searchParams.get("warehouseId") ?? "all");
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get("overdue") === "1");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [sorting, setSorting] = useState<SortingState>([]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkAction, setBulkAction] = useState<"cancel" | "delete" | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrderDetail | undefined>(undefined);
  const [initialItems, setInitialItems] = useState<{ productId: string; quantity: number; unitPrice: number }[] | undefined>(undefined);

  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrderDetail | undefined>(undefined);
  const [cancelling, setCancelling] = useState<PurchaseOrderRow | undefined>(undefined);
  const [deleting, setDeleting] = useState<PurchaseOrderRow | undefined>(undefined);

  const [replenishOrderOpen, setReplenishOrderOpen] = useState(false);
  const [replenishLines, setReplenishLines] = useState<{ productId: string; quantity: number }[]>([]);

  const exportGuard = useSubmitGuard();

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const query: PurchaseOrderQuery = useMemo(
    () => ({
      search: search || undefined,
      status: status === "all" ? undefined : status,
      supplierId: supplierId === "all" ? undefined : supplierId,
      warehouseId: warehouseFilter === "all" ? undefined : warehouseFilter,
      overdue: overdueOnly || undefined,
      page,
      pageSize: PAGE_SIZE,
      sortBy: sorting[0]?.id,
      sortDir: sorting[0]?.desc ? "desc" : "asc",
    }),
    [search, status, supplierId, warehouseFilter, overdueOnly, page, sorting],
  );

  const filterKey = JSON.stringify({ search, status, supplierId, warehouseFilter, overdueOnly, sorting });
  if (useChangedSince(filterKey) && page !== 1) setPage(1);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (supplierId !== "all") params.set("supplierId", supplierId);
    if (warehouseFilter !== "all") params.set("warehouseId", warehouseFilter);
    if (overdueOnly) params.set("overdue", "1");
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `/satin-alma?${qs}` : "/satin-alma", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, supplierId, warehouseFilter, overdueOnly, page]);

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

  const { data: suggestionsData, status: replenishStatus, refetch: refetchReplenishment } = useAsync(
    () => getReplenishmentSuggestions(),
    [],
  );
  const suggestions = suggestionsData ?? [];

  const { data: scorecardData, status: scorecardStatus, refetch: refetchScorecards } = useAsync(
    () => getSupplierScorecards(),
    [],
  );
  const scorecards = scorecardData ?? [];

  function refetchAll() {
    refetch();
    refetchStats();
    refetchReplenishment();
    refetchScorecards();
  }

  const isFiltered =
    Boolean(search) || status !== "all" || supplierId !== "all" || warehouseFilter !== "all" || overdueOnly;

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setStatus("all");
    setSupplierId("all");
    setWarehouseFilter("all");
    setOverdueOnly(false);
  }

  // Deep link from the panel's critical-stock list: ?productId=x or ?productIds=a,b —
  // resolve the products and open the create form pre-filled with them.
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
    // Only run once, from the URL this page mounted with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hero chip shortcuts — each jumps into the tab/filter combination it names.
  function goToOverdue() {
    setTab("orders");
    setStatus("all");
    setOverdueOnly(true);
  }
  function goToReplenishment() {
    setTab("replenishment");
  }
  function goToDrafts() {
    setTab("orders");
    setOverdueOnly(false);
    setStatus("draft");
  }
  function goToArrivingSoon() {
    setTab("orders");
    setOverdueOnly(false);
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

  async function handleCancel() {
    if (!cancelling) return;
    try {
      await cancelPurchaseOrder(cancelling.id);
      toast.success("Sipariş iptal edildi.", { description: `${cancelling.code} iptal edildi.` });
      setCancelling(undefined);
      refetchAll();
    } catch (err) {
      toast.error("Sipariş iptal edilemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
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
        if (onlySelected && selectedIds.size > 0) {
          rows = rows.filter((r) => selectedIds.has(r.id));
        }

        const reportTitle = onlySelected ? `Seçili Siparişler (${rows.length} Adet)` : "Satın Alma Siparişleri";
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

  function openReplenishOrderDialog(lines: { productId: string; quantity: number }[]) {
    setReplenishLines(lines);
    setReplenishOrderOpen(true);
  }

  async function handleConfirmReplenishOrder(input: {
    warehouseId: string;
    expectedAt: string;
    lines: { productId: string; quantity: number }[];
  }) {
    try {
      const created = await createPurchaseOrdersFromSuggestions(input);
      toast.success(`${created.length} taslak sipariş oluşturuldu.`, {
        description: `${input.lines.length} ürün için tedarikçi başına ayrı sipariş hazırlandı.`,
      });
      refetchAll();
      setTab("orders");
      setStatus("draft");
      setOverdueOnly(false);
    } catch (err) {
      toast.error("Sipariş oluşturulamadı", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
      throw err;
    }
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
        meta: { className: "w-[14%] text-left" },
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
        meta: { className: "w-[16%] text-left" },
        cell: ({ row }) => (
          <span className="block truncate" title={row.original.supplierName}>{row.original.supplierName}</span>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Durum",
        enableSorting: false,
        meta: { className: "w-[12%] text-center" },
        cell: ({ row }) => (
          <div className="flex justify-center">
            <PurchaseStatusBadge status={row.original.status} />
          </div>
        ),
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
        meta: { className: "w-[12%] text-right" },
        cell: ({ row }) => (
          <span className="tabular-nums font-semibold">
            {formatCurrency(row.original.total / rate, currency, 1, true)}
          </span>
        ),
      },
      {
        id: "expectedAt",
        accessorKey: "expectedAt",
        header: "Beklenen Teslim",
        meta: { className: "w-[12%] text-right" },
        cell: ({ row }) => {
          const overdue =
            row.original.status !== "received" &&
            row.original.status !== "cancelled" &&
            row.original.expectedAt < new Date().toISOString();
          return (
            <span className={overdue ? "tabular-nums font-medium text-status-critical" : "tabular-nums text-muted-foreground"}>
              {formatDate(row.original.expectedAt)}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { className: "w-16 pr-5 text-right" },
        cell: ({ row }) => {
          const po = row.original;
          const actions = getAvailableActions({ status: po.status, hasReceivedProgress: po.receivedTotal > 0 });
          return (
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
                <Can permission="purchase.manage">
                  <>
                    {(actions.canMarkOrdered || actions.canEdit || actions.canReceive || actions.canCancel || actions.canDelete) && (
                      <DropdownMenuSeparator />
                    )}
                    {actions.canMarkOrdered && (
                      <DropdownMenuItem onClick={() => handleMarkOrdered(po)}>
                        <Send className="size-4" />
                        Siparişi Gönder
                      </DropdownMenuItem>
                    )}
                    {actions.canEdit && (
                      <DropdownMenuItem onClick={() => openEdit(po)}>
                        <Pencil className="size-4" />
                        Düzenle
                      </DropdownMenuItem>
                    )}
                    {actions.canReceive && (
                      <DropdownMenuItem onClick={() => openReceive(po)}>
                        <PackageCheck className="size-4" />
                        Teslim Al
                      </DropdownMenuItem>
                    )}
                    {actions.canCancel && (
                      <DropdownMenuItem variant="destructive" onClick={() => setCancelling(po)}>
                        <Ban className="size-4" />
                        İptal Et
                      </DropdownMenuItem>
                    )}
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
          );
        },
      },
    ],
    [currency, rate, selectedIds, view?.rows],
  );

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
                  <DropdownMenuItem onClick={() => handleExport("pdf")}>
                    <FileText className="size-4 text-status-critical" /> PDF (.pdf)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
          replenishmentCount={suggestions.length}
          currency={currency}
          rate={rate}
          onOverdueClick={goToOverdue}
          onReplenishmentClick={goToReplenishment}
          onDraftClick={goToDrafts}
          onArrivingClick={goToArrivingSoon}
        />

        <Tabs value={tab} onValueChange={(v) => setTab(v as CommandTab)} className="gap-4">
          <TabsList variant="line" className="w-full justify-start overflow-x-auto custom-scrollbar sm:w-fit">
            <TabsTrigger value="orders">
              <ShoppingCart className="size-4" />
              Siparişler
            </TabsTrigger>
            <TabsTrigger value="replenishment">
              <AlertTriangle className="size-4" />
              İkmal Önerileri
              {suggestions.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 text-micro">
                  {suggestions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="scorecard">
              <Truck className="size-4" />
              Tedarikçi Karnesi
            </TabsTrigger>
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
                      <Select value={status} onValueChange={(v) => setStatus((v as PurchaseOrderStatus | "all") ?? "all")}>
                        <SelectTrigger className="h-9 w-fit min-w-[160px]">
                          <SelectValue>{status === "all" ? "Tüm Durumlar" : PURCHASE_STATUS_LABELS[status]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tüm Durumlar</SelectItem>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {PURCHASE_STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={supplierId} onValueChange={(v) => setSupplierId((v as string) ?? "all")}>
                        <SelectTrigger className="h-9 w-fit min-w-[180px]">
                          <SelectValue>
                            {supplierId === "all" ? "Tüm Tedarikçiler" : suppliers.find((s) => s.id === supplierId)?.name}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tüm Tedarikçiler</SelectItem>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={warehouseFilter} onValueChange={(v) => setWarehouseFilter((v as string) ?? "all")}>
                        <SelectTrigger className="h-9 w-fit min-w-[170px]">
                          <SelectValue>
                            {warehouseFilter === "all" ? "Tüm Depolar" : warehouses.find((w) => w.id === warehouseFilter)?.name}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tüm Depolar</SelectItem>
                          {warehouses.map((w) => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant={overdueOnly ? "secondary" : "outline"}
                        onClick={() => setOverdueOnly((v) => !v)}
                        className="h-9 gap-1.5"
                      >
                        <Clock className="size-3.5" />
                        Sadece Gecikenler
                      </Button>
                      {isFiltered && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
                          <X className="size-4" />
                          Filtreleri Temizle
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="outline" size="sm" disabled={exportGuard.pending} className="ml-auto shrink-0">
                              {exportGuard.pending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                              Dışa Aktar
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleExport("excel")}>
                            <FileSpreadsheet className="size-4 text-status-good" /> Excel (.xlsx)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport("pdf")}>
                            <FileText className="size-4 text-status-critical" /> PDF (.pdf)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                      variant="outline"
                      onClick={() => handleExport("excel", true)}
                      disabled={exportGuard.pending}
                      className="h-8 gap-1 text-xs"
                    >
                      <Download className="size-3.5" />
                      Dışa Aktar
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

          <TabsContent value="replenishment">
            <ReplenishmentPanel
              suggestions={suggestions}
              loading={replenishStatus === "loading" && suggestions.length === 0}
              currency={currency}
              rate={rate}
              onCreateOrders={openReplenishOrderDialog}
            />
          </TabsContent>

          <TabsContent value="scorecard">
            <SupplierScorecardPanel
              scorecards={scorecards}
              loading={scorecardStatus === "loading" && scorecards.length === 0}
              currency={currency}
              rate={rate}
            />
          </TabsContent>
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

        <ReplenishmentOrderDialog
          open={replenishOrderOpen}
          onOpenChange={setReplenishOrderOpen}
          lines={replenishLines}
          suggestions={suggestions}
          warehouses={warehouses}
          onConfirm={handleConfirmReplenishOrder}
        />

        <AlertDialog open={Boolean(cancelling)} onOpenChange={(open) => !open && setCancelling(undefined)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Siparişi iptal et</AlertDialogTitle>
              <AlertDialogDescription>
                {cancelling ? `"${cancelling.code}" iptal edilecek. Bu işlem geri alınamaz.` : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Vazgeç</AlertDialogCancel>
              <AlertDialogAction variant="destructive-solid" onClick={handleCancel}>
                İptal Et
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
