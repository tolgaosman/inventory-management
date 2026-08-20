"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Search, X, Download, Loader2, FileSpreadsheet, FileText } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/common/page-header";
import { Can } from "@/components/common/can";
import { ForbiddenState } from "@/components/common/forbidden-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Section, SectionStack } from "@/components/common/section";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnFilter } from "@/components/data-table/data-table-filter";
import { ProductImageThumbnail } from "@/components/common/product-image-thumbnail";
import { MovementTypeBadge } from "@/components/common/status-badge";
import { MovementCommandHero } from "@/components/stock/movement-command-hero";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAsync } from "@/lib/hooks/use-async";
import { useChangedSince } from "@/lib/hooks/use-reset-on-change";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import { listMovements, getMovementSummary, type MovementQuery } from "@/lib/api/movements";
import { listWarehouses, listUsers } from "@/lib/api/catalog";
import { listProducts } from "@/lib/api/products";
import { buildReportExcel } from "@/lib/export/excel";
import { buildReportPdf } from "@/lib/export/pdf";
import { downloadBlob, reportFilename } from "@/lib/export/download";
import type { ReportData } from "@/lib/export/report-data";
import { formatNumber, formatDateTime, formatSigned } from "@/lib/format";
import { MOVEMENT_TYPE_LABELS, MOVEMENT_REASON_LABELS, PAGE_SIZE } from "@/lib/constants";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings-context";
import { cn } from "@/lib/utils";
import type { MovementReason, MovementType, StockMovement } from "@/lib/types";

const MOVEMENT_TYPE_COLOR: Record<MovementType, string> = {
  giris: "text-status-good",
  cikis: "text-status-critical",
  transfer: "text-primary",
};

function toStartOfDayIso(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toISOString();
}

function toEndOfDayIso(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59.999`).toISOString();
}

export function MovementHistoryClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { name, can } = useAuth();
  const { company } = useSettings();
  const exportGuard = useSubmitGuard();

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [search, setSearch] = useState(searchInput);
  const [type, setType] = useState(searchParams.get("type") ?? "all");
  const [reason, setReason] = useState(searchParams.get("reason") ?? "all");
  const [warehouseId, setWarehouseId] = useState(searchParams.get("warehouseId") ?? "all");
  const [userId, setUserId] = useState(searchParams.get("userId") ?? "all");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") ?? "");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const query: MovementQuery = useMemo(
    () => ({
      search: search || undefined,
      type: type === "all" ? undefined : (type as MovementType),
      reason: reason === "all" ? undefined : (reason as MovementReason),
      warehouseId: warehouseId === "all" ? undefined : warehouseId,
      userId: userId === "all" ? undefined : userId,
      dateFrom: dateFrom ? toStartOfDayIso(dateFrom) : undefined,
      dateTo: dateTo ? toEndOfDayIso(dateTo) : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [search, type, reason, warehouseId, userId, dateFrom, dateTo, page],
  );

  const filterKey = JSON.stringify({ search, type, reason, warehouseId, userId, dateFrom, dateTo });
  if (useChangedSince(filterKey) && page !== 1) setPage(1);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (type !== "all") params.set("type", type);
    if (reason !== "all") params.set("reason", reason);
    if (warehouseId !== "all") params.set("warehouseId", warehouseId);
    if (userId !== "all") params.set("userId", userId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `/stok/hareketler?${qs}` : "/stok/hareketler", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, type, reason, warehouseId, userId, dateFrom, dateTo, page]);

  // One coordinated fetch instead of 4 independent waves: everything the page
  // needs resolves together in a single Promise.all, so the UI fills in at
  // once instead of piecemeal. Reference data (warehouses/users/products) is
  // cached by lib/api-cache.ts, so re-running this on every filter change is
  // cheap for those — only the movements list and summary counts are genuinely
  // re-fetched from the network.
  const { status, data, staleData, error, refetch } = useAsync(async () => {
    const [movements, warehouses, users, productsResult, summary] = await Promise.all([
      listMovements(query),
      listWarehouses().catch(() => []),
      can("users.manage") ? listUsers().catch(() => []) : Promise.resolve([]),
      listProducts({ pageSize: 2000 }).catch(() => ({ rows: [], total: 0, page: 1, pageSize: 2000 })),
      getMovementSummary(query).catch(() => undefined),
    ]);
    return { movements, warehouses, users, products: productsResult.rows, summary };
  }, [JSON.stringify(query), can]);

  const view = (data ?? staleData)?.movements;
  const warehouses = useMemo(() => (data ?? staleData)?.warehouses ?? [], [data, staleData]);
  const users = useMemo(() => (data ?? staleData)?.users ?? [], [data, staleData]);
  const products = useMemo(() => (data ?? staleData)?.products ?? [], [data, staleData]);
  const summary = (data ?? staleData)?.summary;

  // Hero data: today's net flow and fire/iade anomaly count, plus the
  // top-volume warehouse derived client-side from the already-loaded list.
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const heroStats = useMemo(() => {
    if (!summary) return undefined;
    const topWarehouse = [...warehouses].sort((a, b) => (b.units ?? 0) - (a.units ?? 0))[0];
    return {
      todayIn: summary.todayIn,
      todayOut: summary.todayOut,
      fireCount: summary.fireCount,
      topWarehouseId: topWarehouse?.id,
      topWarehouseName: topWarehouse?.name,
      topWarehouseCount: topWarehouse?.units,
    };
  }, [summary, warehouses]);

  const isFiltered = Boolean(
    search || type !== "all" || reason !== "all" || warehouseId !== "all" || userId !== "all" || dateFrom || dateTo,
  );

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setType("all");
    setReason("all");
    setWarehouseId("all");
    setUserId("all");
    setDateFrom("");
    setDateTo("");
  }

  async function handleExportFormat(format: "excel" | "pdf") {
    await exportGuard.guard(async () => {
      try {
        const all = await listMovements({ ...query, page: 1, pageSize: 10000 });

        const report: ReportData = {
          company: company.companyName,
          title: "Stok Hareketleri Geçmişi",
          generatedAt: new Date(),
          rangeLabel: "Filtrelenmiş Sonuçlar",
          generatedBy: name,
          currency: "try",
          kpis: [],
          sections: [
            {
              title: "Stok Hareketleri",
              columns: ["Tarih", "Tip", "Ürün", "SKU", "Depo", "Hedef Depo", "Miktar", "Önceki", "Yeni", "Sebep", "Kullanıcı"],
              numericColumns: [6, 7, 8],
              emptyMessage: "Hareket bulunamadı.",
              rows: all.rows.map((m) => {
                const product = products.find((p) => p.id === m.productId);
                const sourceName = warehouses.find((w) => w.id === m.warehouseId)?.name ?? "-";
                const targetName = m.targetWarehouseId
                  ? warehouses.find((w) => w.id === m.targetWarehouseId)?.name ?? "-"
                  : "-";
                const userName = m.userName ?? "-";
                return [
                  formatDateTime(m.createdAt),
                  MOVEMENT_TYPE_LABELS[m.type],
                  product?.name ?? "-",
                  product?.sku ?? "-",
                  sourceName,
                  targetName,
                  m.type === "cikis" || m.type === "transfer" ? -m.quantity : m.quantity,
                  m.previousQuantity,
                  m.newQuantity,
                  MOVEMENT_REASON_LABELS[m.reason],
                  userName,
                ];
              }),
            },
          ],
        };

        const ext = format === "excel" ? "xlsx" : "pdf";
        const filename = reportFilename(ext).replace("stok-raporu", "hareket-gecmisi");

        if (format === "excel") {
          downloadBlob(buildReportExcel(report, ["all"]), filename);
          toast.success("Excel Raporu İndirildi", { description: `${all.rows.length} hareket Excel (.xlsx) olarak kaydedildi.` });
        } else {
          downloadBlob(await buildReportPdf(report, ["all"]), filename);
          toast.success("PDF Raporu İndirildi", { description: `${all.rows.length} hareket PDF olarak kaydedildi.` });
        }
      } catch (err) {
        toast.error("Dışa aktarılamadı", {
          description: err instanceof Error ? err.message : "Beklenmedik bir hata oluştu.",
        });
      }
    });
  }

  const columns = useMemo<ColumnDef<StockMovement, unknown>[]>(
    () => [
      {
        id: "type",
        header: "Tip",
        meta: { 
          className: "w-[11%] whitespace-nowrap px-4 text-center",
          filterElement: (
            <DataTableColumnFilter
              value={type}
              onValueChange={setType}
              options={(Object.keys(MOVEMENT_TYPE_LABELS) as MovementType[]).map((t) => ({ label: MOVEMENT_TYPE_LABELS[t], value: t }))}
              title="Hareket Tipi"
            />
          )
        },
        cell: ({ row }) => <div className="flex justify-center"><MovementTypeBadge type={row.original.type} /></div>,
      },
      {
        id: "product",
        header: "Ürün",
        meta: { className: "w-[24%] text-left" },
        cell: ({ row }) => {
          const product = products.find((p) => p.id === row.original.productId);
          return (
            <Link
              href={`/urunler/${row.original.productId}`}
              className="flex items-center gap-3 group hover:text-primary"
            >
              <ProductImageThumbnail src={product?.imageUrl} alt={product?.name ?? ""} size="sm" />
              <div className="min-w-0 text-left">
                <span className="block truncate font-medium text-foreground group-hover:text-primary transition-colors">
                  {product?.name ?? "Bilinmeyen ürün"}
                </span>
                <span className="block font-mono text-xs text-muted-foreground">{product?.sku}</span>
              </div>
            </Link>
          );
        },
      },
      {
        id: "warehouse",
        header: "Depo",
        meta: { 
          className: "w-[19%] text-center",
          filterElement: (
            <DataTableColumnFilter
              value={warehouseId}
              onValueChange={setWarehouseId}
              options={warehouses.map((w) => ({ label: w.name, value: w.id }))}
              title="Depo Seç"
            />
          )
        },
        cell: ({ row }) => {
          const m = row.original;
          const sourceName = warehouses.find((w) => w.id === m.warehouseId)?.name ?? "-";
          if (m.type !== "transfer") {
            return <span className="block truncate text-center" title={sourceName}>{sourceName}</span>;
          }
          const targetName = warehouses.find((w) => w.id === m.targetWarehouseId)?.name ?? "-";
          return (
            <span className="block truncate text-center" title={`${sourceName} → ${targetName}`}>
              {sourceName} <span className="text-muted-foreground">→</span> {targetName}
            </span>
          );
        },
      },
      {
        id: "quantity",
        header: "Miktar",
        meta: { className: "w-[10%] whitespace-nowrap px-4 text-center" },
        cell: ({ row }) => {
          const m = row.original;
          const signed = m.type === "cikis" ? -m.quantity : m.quantity;
          return (
            <span className={cn("font-medium tabular-nums", MOVEMENT_TYPE_COLOR[m.type])}>
              {m.type === "transfer" ? formatNumber(m.quantity) : formatSigned(signed)}
            </span>
          );
        },
      },
      {
        id: "reason",
        header: "Sebep",
        meta: { 
          className: "w-[14%] text-center",
          filterElement: (
            <DataTableColumnFilter
              value={reason}
              onValueChange={setReason}
              options={(Object.keys(MOVEMENT_REASON_LABELS) as MovementReason[]).map((r) => ({ label: MOVEMENT_REASON_LABELS[r], value: r }))}
              title="Sebep Seç"
            />
          )
        },
        cell: ({ row }) => {
          const label = MOVEMENT_REASON_LABELS[row.original.reason];
          return <span className="block truncate text-center" title={label}>{label}</span>;
        },
      },
      {
        id: "user",
        header: "Kullanıcı",
        meta: { 
          className: "w-[12%] text-center",
          filterElement: (
            <DataTableColumnFilter
              value={userId}
              onValueChange={setUserId}
              options={users.map((u) => ({ label: u.name, value: u.id }))}
              title="Kullanıcı Seç"
            />
          )
        },
        cell: ({ row }) => {
          const userName = row.original.userName ?? "-";
          return <span className="block truncate text-center" title={userName}>{userName}</span>;
        },
      },
      {
        id: "createdAt",
        header: "Tarih",
        meta: { className: "w-[10%] whitespace-nowrap px-4 text-center" },
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [products, warehouses, users],
  );

  return (
    <Can permission="stock.view" fallback={<Forbidden />}>
      <div className="flex flex-col space-y-6">
      <PageHeader
        title="Stok Hareketleri Geçmişi"
        description="Tüm stok giriş, çıkış ve transfer hareketlerinin geçmişi."
        actions={
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
              <DropdownMenuItem onClick={() => handleExportFormat("excel")}>
                <FileSpreadsheet className="size-4 text-status-good" /> Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportFormat("pdf")}>
                <FileText className="size-4 text-status-bad" /> PDF (.pdf)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <MovementCommandHero
        stats={heroStats}
        onTodayClick={() => {
          setDateFrom(todayStr);
          setDateTo(todayStr);
        }}
        onFireClick={() => setReason("fire")}
        onTopWarehouseClick={() => {
          if (heroStats?.topWarehouseId) setWarehouseId(heroStats.topWarehouseId);
        }}
        typeBreakdown={{
          total: view?.total,
          in: summary?.typeCounts.giris,
          out: summary?.typeCounts.cikis,
          transfer: summary?.typeCounts.transfer,
        }}
        onTypeClick={(t) => setType(t)}
      />

      <SectionStack
        className={cn(
          "flex flex-col space-y-0 gap-6",
          status === "loading" ? "opacity-60 transition-opacity" : "transition-opacity"
        )}
      >
        <Section index={0} className="shrink-0">
          <Card>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Ürün adı veya SKU ara…"
                    className="h-9 pl-8"
                  />
                </div>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  max={dateTo || undefined}
                  className="h-9 w-fit"
                  aria-label="Başlangıç tarihi"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom || undefined}
                  className="h-9 w-fit"
                  aria-label="Bitiş tarihi"
                />

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

        <Section index={2} className="flex flex-col">
          <DataTable
            columns={columns}
            data={view?.rows ?? []}
            total={view?.total ?? 0}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            loading={!view}
            error={status === "error" && !view ? error : undefined}
            onRetry={refetch}
            isFiltered={isFiltered}
            emptyTitle="Henüz hareket yok"
            emptyDescription="Kayıtlı bir stok hareketi bulunmuyor."
          />
        </Section>
      </SectionStack>
      </div>
    </Can>
  );
}

function Forbidden() {
  return (
    <div className="space-y-6">
      <PageHeader title="Stok Hareketleri Geçmişi" />
      <ForbiddenState message="Stok hareketlerini görüntülemek için yetkiniz yok." />
    </div>
  );
}
