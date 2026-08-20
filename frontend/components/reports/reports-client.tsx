"use client";

import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
  PieChart,
  Pie,
  AreaChart,
  Area,
  type LabelProps,
} from "recharts";
import {
  FileSpreadsheet,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Warehouse,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  ShoppingCart,
  Package,
  Loader2,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  Inbox,
  Wallet,
  Boxes,
  type LucideIcon,
} from "lucide-react";
import { useAsync } from "@/lib/hooks/use-async";
import { PageHeader } from "@/components/common/page-header";
import { Can } from "@/components/common/can";
import { ForbiddenState } from "@/components/common/forbidden-state";
import { Section, SectionStack } from "@/components/common/section";
import { PanelCard } from "@/components/common/panel-card";
import { StatGrid } from "@/components/common/stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PurchaseStatusBadge } from "@/components/common/status-badge";
import { ProductImageThumbnail } from "@/components/common/product-image-thumbnail";
import { CHART_GRID, CHART_X_AXIS, ChartSwatch, ChartLegend, ChartTooltip } from "@/components/charts/chart-primitives";
import { WarehouseCapacityRadials } from "@/components/reports/warehouse-capacity-radials";
import { WarehouseValueChart } from "@/components/reports/warehouse-value-chart";
import { WarehouseMoversChart } from "@/components/reports/warehouse-movers-chart";
import { useAuth, type Permission } from "@/lib/auth";
import { useSettings } from "@/lib/settings-context";
import { useCurrency } from "@/lib/currency-context";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import { CURRENCY_SYMBOLS } from "@/lib/export/report-data";
import {
  useReportDataset,
  useWarehouseCategoryShares,
  warehouseDetails as computeWarehouseDetails,
  criticalProducts as computeCriticalProducts,
  type ReportDataset,
} from "@/lib/reports/dataset";
import { getProductsReport, getMovementsReport, type ReportMover } from "@/lib/api/reports";
import { listMovements } from "@/lib/api/movements";
import type { StockMovement } from "@/lib/types";
import { getDashboardData, MONTHS_BY_RANGE, RANGE_LABELS, type DateRangePreset } from "@/lib/api/dashboard";
import { formatNumber, formatCurrency, formatDateTime, formatSigned } from "@/lib/format";
import { MOVEMENT_TYPE_LABELS, MOVEMENT_REASON_LABELS, PURCHASE_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS: DateRangePreset[] = ["bu-ay", "son-3-ay", "son-6-ay", "bu-yil"];

type ReportTab = "urunler" | "depolar" | "hareketler" | "satin-alma";

const REPORT_TABS: { value: ReportTab; label: string; icon: React.ElementType; permission: Permission | Permission[] }[] = [
  { value: "urunler", label: "Ürünler", icon: Package, permission: ["reports.stock", "reports.financial"] },
  { value: "depolar", label: "Depolar", icon: Warehouse, permission: "reports.stock" },
  { value: "hareketler", label: "Hareketler", icon: ArrowLeftRight, permission: ["reports.stock", "reports.financial"] },
  { value: "satin-alma", label: "Satın Alma", icon: ShoppingCart, permission: "reports.financial" },
];

const MOVEMENT_TYPE_COLOR: Record<string, string> = {
  giris: "text-status-good",
  cikis: "text-status-critical",
  transfer: "text-primary",
};

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const EMPTY_ARRAY: never[] = [];

const EMPTY_KPIS = {
  totalProducts: 0,
  totalWarehouses: 0,
  criticalStockCount: 0,
  todayIn: 0,
  todayOut: 0,
  openPurchaseOrders: 0,
  pendingDeliveries: 0,
  purchaseTotalValue: 0,
  cancelledOrders: 0,
  totalPurchaseOrders: 0,
  onHandUnits: 0,
  incomingUnits: 0,
  totalUsers: 0,
  totalSuppliers: 0,
  categoryCount: 0,
  productVariantCount: 0,
};

export function ReportsClient() {
  const { name, can } = useAuth();
  const { company } = useSettings();
  const { currency, rates } = useCurrency();
  const visibleReportTabs = useMemo(
    () => REPORT_TABS.filter((t) => (Array.isArray(t.permission) ? t.permission.some(can) : can(t.permission))),
    [can],
  );
  const [range, setRange] = useState<DateRangePreset>("son-6-ay");
  const [tab, setTab] = useState<ReportTab>("urunler");
  const [moversWarehouseId, setMoversWarehouseId] = useState<string>("all");
  const [purchasePage, setPurchasePage] = useState(1);

  // Land on the first tab the user can actually see, in case "urunler" (the
  // default) isn't one of them — e.g. a reports.financial-only role.
  useEffect(() => {
    if (visibleReportTabs.length > 0 && !visibleReportTabs.some((t) => t.value === tab)) {
      setTab(visibleReportTabs[0].value);
    }
  }, [visibleReportTabs, tab]);

  useEffect(() => {
    setPurchasePage(1);
  }, [range]);

  const rate = rates?.[currency] ?? 1;
  const months = MONTHS_BY_RANGE[range];
  const symbol = CURRENCY_SYMBOLS[currency];

  const { data: rdData, staleData: rdStale, status: datasetStatus } = useReportDataset();
  const dataset = rdData ?? rdStale;
  const products = dataset?.products ?? EMPTY_ARRAY;
  const suppliers = dataset?.suppliers ?? EMPTY_ARRAY;
  const warehouses = dataset?.warehouses ?? EMPTY_ARRAY;

  const { data: dashboardData } = useAsync(() => getDashboardData(range), [range]);
  const kpis = dashboardData?.kpis ?? EMPTY_KPIS;

  const warehouseDetails = useMemo(() => (dataset ? computeWarehouseDetails(dataset) : []), [dataset]);
  const warehouseCategoryShares = useWarehouseCategoryShares(dataset);

  // Top/least/per-warehouse movers come from the DB-aggregate /reports/products
  // endpoint instead of scanning the full movements table in the browser.
  const { data: globalMoversReport } = useAsync(() => getProductsReport(range, { limit: 10 }), [range]);
  const topMovers: ReportMover[] = globalMoversReport?.topMovers ?? EMPTY_ARRAY;
  const leastMovers: ReportMover[] = globalMoversReport?.leastMovers ?? EMPTY_ARRAY;

  const { data: warehouseMoversReport } = useAsync(
    () => getProductsReport(range, { limit: 8, warehouseId: moversWarehouseId === "all" ? undefined : moversWarehouseId }),
    [range, moversWarehouseId],
  );
  const warehouseMovers: ReportMover[] = warehouseMoversReport?.topMovers ?? EMPTY_ARRAY;

  const criticalProducts = useMemo(() => (dataset ? computeCriticalProducts(dataset) : []), [dataset]);

  const rangeStart = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [months]);

  // Type counts/sums come from the DB-aggregate /reports/movements endpoint;
  // only the ~30 rows actually rendered per MovementTable are fetched raw
  // (server already orders newest-first), instead of downloading and slicing
  // the entire stock_movements table.
  const { data: movementsReport } = useAsync(() => getMovementsReport(range), [range]);
  const inTypeStats = movementsReport?.byType.find((t) => t.type === "giris");
  const outTypeStats = movementsReport?.byType.find((t) => t.type === "cikis");
  const transferTypeStats = movementsReport?.byType.find((t) => t.type === "transfer");

  const { data: movementRows } = useAsync(async () => {
    const [giris, cikis, transfer] = await Promise.all([
      listMovements({ type: "giris", dateFrom: rangeStart, page: 1, pageSize: 30 }),
      listMovements({ type: "cikis", dateFrom: rangeStart, page: 1, pageSize: 30 }),
      listMovements({ type: "transfer", dateFrom: rangeStart, page: 1, pageSize: 20 }),
    ]);
    return { giris: giris.rows, cikis: cikis.rows, transfer: transfer.rows };
  }, [rangeStart]);
  const inMovements = movementRows?.giris ?? EMPTY_ARRAY;
  const outMovements = movementRows?.cikis ?? EMPTY_ARRAY;
  const transferMovements = movementRows?.transfer ?? EMPTY_ARRAY;

  const filteredOrders = useMemo(
    () =>
      (dataset?.orders ?? [])
        .filter((po) => po.createdAt >= rangeStart)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [dataset, rangeStart],
  );

  const purchasePageSize = 20;
  const totalPurchasePages = Math.ceil(filteredOrders.length / purchasePageSize);
  const paginatedOrders = useMemo(() => {
    return filteredOrders.slice((purchasePage - 1) * purchasePageSize, purchasePage * purchasePageSize);
  }, [filteredOrders, purchasePage]);

  // Purchase order status breakdown for pie
  const orderStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const po of filteredOrders) {
      counts[po.status] = (counts[po.status] ?? 0) + 1;
    }
    return Object.entries(counts).map(([key, value]) => ({
      name: PURCHASE_STATUS_LABELS[key as keyof typeof PURCHASE_STATUS_LABELS] ?? key,
      value,
    }));
  }, [filteredOrders]);

  const topSuppliersData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const po of filteredOrders) {
      counts[po.supplierId] = (counts[po.supplierId] ?? 0) + po.total;
    }
    return Object.entries(counts)
      .map(([supplierId, total]) => {
        const supplier = suppliers.find((s) => s.id === supplierId);
        return {
          name: supplier?.name ?? "Bilinmiyor",
          total: total / rate,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredOrders, suppliers, rate]);

  const monthlyPurchaseTrend = useMemo(() => {
    const monthData: Record<string, { total: number; count: number; byStatus: Record<string, number> }> = {};
    for (const po of filteredOrders) {
      const d = new Date(po.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthData[key]) monthData[key] = { total: 0, count: 0, byStatus: {} };
      const amt = po.total;
      monthData[key].total += amt;
      monthData[key].count += 1;
      const statusLabel = PURCHASE_STATUS_LABELS[po.status as keyof typeof PURCHASE_STATUS_LABELS] ?? po.status;
      monthData[key].byStatus[statusLabel] = (monthData[key].byStatus[statusLabel] ?? 0) + amt;
    }
    // Collect all unique status labels
    const allStatuses = new Set<string>();
    Object.values(monthData).forEach((m) => Object.keys(m.byStatus).forEach((s) => allStatuses.add(s)));

    return Object.entries(monthData)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, data]) => {
        const [year, month] = key.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1);
        const row: Record<string, string | number> = {
          name: new Intl.DateTimeFormat("tr-TR", { month: "short", year: "2-digit" }).format(date),
          total: data.total / rate,
          count: data.count,
        };
        for (const status of allStatuses) {
          row[status] = (data.byStatus[status] ?? 0) / rate;
        }
        return row;
      });
  }, [filteredOrders, rate]);

  const monthlyTrendStatuses = useMemo(() => {
    const statuses = new Set<string>();
    for (const row of monthlyPurchaseTrend) {
      Object.keys(row).forEach((k) => {
        if (k !== "name" && k !== "total" && k !== "count") statuses.add(k);
      });
    }
    return [...statuses];
  }, [monthlyPurchaseTrend]);

  const rangeSelector = (
    <Select value={range} onValueChange={(v) => setRange(v as DateRangePreset)}>
      <SelectTrigger className="h-8 w-fit min-w-[140px] text-xs">
        <SelectValue>{RANGE_LABELS[range]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {RANGE_OPTIONS.map((r) => (
          <SelectItem key={r} value={r}>{RANGE_LABELS[r]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const inPercent = Math.round(inTypeStats?.percent ?? 0);
  const outPercent = Math.round(outTypeStats?.percent ?? 0);
  const transferPercent = Math.round(transferTypeStats?.percent ?? 0);

  const warehouseKpis = useMemo(
    () => ({
      totalWarehouses: warehouseDetails.length,
      totalUnits: warehouseDetails.reduce((sum, w) => sum + w.units, 0),
      totalValue: warehouseDetails.reduce((sum, w) => sum + w.totalValue, 0),
      avgCapacity:
        warehouseDetails.length > 0
          ? Math.round(warehouseDetails.reduce((sum, w) => sum + w.capacityPercent, 0) / warehouseDetails.length)
          : 0,
    }),
    [warehouseDetails],
  );

  // Category chart data: one row per top-level category, one field per warehouse
  // (recharts stacked bars read series off object keys named after each warehouse).
  const categoryByWarehouseData = useMemo(() => {
    const categoryNames = new Set<string>();
    for (const w of warehouseCategoryShares) {
      for (const s of w.shares) categoryNames.add(s.name);
    }
    return [...categoryNames].map((catName) => {
      const row: Record<string, string | number> = { category: catName };
      for (const w of warehouseCategoryShares) {
        row[w.name] = w.shares.find((s) => s.name === catName)?.units ?? 0;
      }
      return row;
    });
  }, [warehouseCategoryShares]);

  return (
    <Can permission={["reports.stock", "reports.financial"]} fallback={<Forbidden />}>
      <div className={cn("space-y-6", datasetStatus === "loading" && !dataset && "opacity-60 transition-opacity")}>
      <PageHeader
        title="Raporlar"
        description="Envanter ve stok operasyonlarınızı görsellerle analiz edin."
        actions={
          <>
            {rangeSelector}
          </>
        }
      />

      <Section index={0}>
        <StatGrid
          className="grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
          items={[
            { icon: Package, tint: "blue", label: "Toplam Ürün", value: formatNumber(kpis.totalProducts) },
            { icon: AlertTriangle, tint: "red", label: "Stok İhtiyaçları", value: formatNumber(kpis.criticalStockCount), emphasize: kpis.criticalStockCount > 0 },
            { icon: ArrowDownToLine, tint: "green", label: "Bugün Giriş", value: `${formatNumber(kpis.todayIn)} adet` },
            { icon: ArrowUpFromLine, tint: "amber", label: "Bugün Çıkış", value: `${formatNumber(kpis.todayOut)} adet` },
            { icon: ShoppingCart, tint: "teal", label: "Açık Sipariş", value: formatNumber(kpis.openPurchaseOrders) },
            { icon: Warehouse, tint: "plum", label: "Eldeki Miktar", value: `${formatNumber(kpis.onHandUnits)} adet` },
          ]}
        />
      </Section>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ReportTab)} className="gap-4">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto custom-scrollbar sm:w-fit">
          {visibleReportTabs.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value}>
              <Icon className="size-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Ürünler ─────────────────────────────────────────────────────── */}
        <TabsContent value="urunler">
          <SectionStack>
            <Section index={0} className="grid gap-4 lg:grid-cols-2">
              <MoversChart
                title="En Çok Hareket Gören Ürünler"
                icon={TrendingUp}
                data={topMovers.slice(0, 8)}
              />
              <LeastMoversList items={leastMovers.slice(0, 8)} />
            </Section>

            <Section index={1}>
              <PanelCard
                title="Stok İhtiyaçları"
                meta={criticalProducts.length > 0 ? `${criticalProducts.length} ürün` : undefined}
                actions={
                  <Link href="/urunler?stockStatus=kritik" className="flex items-center gap-1 text-xs text-primary hover:underline">
                    Ürünlerde gör <ChevronRight className="size-3.5" />
                  </Link>
                }
              >
                {criticalProducts.length === 0 ? (
                  <EmptyState icon={CheckCircle2} title="Stok ihtiyacı yok" description="Tüm ürünler minimum stok seviyesinin üzerinde." />
                ) : (
                  <div className="max-h-[340px] space-y-2 overflow-y-auto custom-scrollbar pr-1">
                    {criticalProducts.map((p) => {
                      const shortfall = p.minStock - p.totalStock;
                      const fillPercent = p.minStock > 0 ? Math.round((p.totalStock / p.minStock) * 100) : 0;
                      return (
                        <div key={p.id} className="rounded-lg border border-status-critical/15 bg-status-critical/5 px-3 py-2.5 transition-colors hover:bg-status-critical/10">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <ProductImageThumbnail src={p.imageUrl} alt={p.name} size="xs" />
                              <Link href={`/urunler/${p.id}`} className="truncate text-sm font-semibold text-foreground hover:underline">
                                {p.name}
                              </Link>
                            </div>
                            <Badge variant="destructive" className="shrink-0 text-xs tabular-nums">
                              -{formatNumber(shortfall)} eksik
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 space-y-1">
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-status-critical/15">
                                <div
                                  className="h-full rounded-full bg-status-critical transition-all"
                                  style={{ width: `${Math.min(fillPercent, 100)}%` }}
                                />
                              </div>
                            </div>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                              {formatNumber(p.totalStock)} / {formatNumber(p.minStock)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </PanelCard>
            </Section>
          </SectionStack>
        </TabsContent>

        {/* ── Depolar ─────────────────────────────────────────────────────── */}
        <TabsContent value="depolar">
          <SectionStack>
            <Section index={0}>
              <StatGrid
                className="grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                items={[
                  { icon: Warehouse, tint: "blue", label: "Toplam Depo", value: formatNumber(warehouseKpis.totalWarehouses) },
                  { icon: Boxes, tint: "teal", label: "Toplam Stok Adedi", value: `${formatNumber(warehouseKpis.totalUnits)} adet` },
                  {
                    icon: Wallet,
                    tint: "green",
                    label: "Toplam Envanter Değeri",
                    value: formatCurrency(warehouseKpis.totalValue / rate, currency, 1, true),
                  },
                  { icon: AlertTriangle, tint: "amber", label: "Ortalama Doluluk Oranı", value: `%${warehouseKpis.avgCapacity}` },
                ]}
              />
            </Section>

            {/* Yan yana depo karşılaştırması: her depo için tek doluluk halkası + destekleyici metrikler. */}
            <Section index={1}>
              <WarehouseCapacityRadials data={warehouseDetails} currency={currency} rate={rate} />
            </Section>

            <Section index={2} className="grid gap-4 lg:grid-cols-2">
              <WarehouseValueChart data={warehouseDetails} currency={currency} rate={rate} />

              <PanelCard
                title="Depo Bazında Kategori Dağılımı"
                bodyClassName="flex flex-col"
              >
                {/* CSS-only hover: dim siblings without triggering React re-renders */}
                <style>{`
                  .cdw-bar:hover .recharts-bar-rectangle { opacity: 0.5; transition: opacity 0.3s; }
                  .cdw-bar .recharts-bar-rectangle { transition: opacity 0.3s; }
                  .cdw-bar .recharts-bar-rectangle:hover { opacity: 1 !important; cursor: pointer; }
                `}</style>
                {categoryByWarehouseData.length === 0 ? (
                  <EmptyState icon={Boxes} title="Veri yok" />
                ) : (
                  <>
                    <ChartLegend
                      className="mb-3 flex flex-wrap justify-start gap-x-4 gap-y-1.5 space-y-0"
                      items={warehouses.map((w, i) => ({
                        label: w.name,
                        color: CHART_COLORS[i % CHART_COLORS.length],
                      }))}
                    />
                    <div className="min-h-[280px] w-full flex-1">
                      <ResponsiveContainer width="100%" height="100%" minHeight={280}>
                        <BarChart
                          data={categoryByWarehouseData}
                          layout="vertical"
                          margin={{ left: 0, right: 16, top: 16, bottom: 0 }}
                          barCategoryGap="20%"
                          className="cdw-bar"
                        >
                          <XAxis type="number" hide domain={[0, 'dataMax']} />
                          <YAxis
                            type="category"
                            dataKey="category"
                            width={160}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 12, fontWeight: 500 }}
                          />
                          <Tooltip
                            cursor={false}
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null;
                              const rows = warehouses
                                .map((w, i) => ({
                                  label: w.name,
                                  color: CHART_COLORS[i % CHART_COLORS.length],
                                  raw: Number(payload.find((p) => p.dataKey === w.name)?.value ?? 0),
                                }))
                                .filter((r) => r.raw > 0)
                                .sort((a, b) => b.raw - a.raw);
                              const total = rows.reduce((sum, r) => sum + r.raw, 0);
                              return (
                                <ChartTooltip
                                  title={String(label)}
                                  rows={[
                                    ...rows.map((r) => ({ label: r.label, color: r.color, value: formatNumber(r.raw) })),
                                    { label: "Toplam", color: "var(--muted-foreground)", value: formatNumber(total), divider: true },
                                  ]}
                                />
                              );
                            }}
                          />
                          {warehouses.map((w, i) => (
                            <Bar
                              key={w.id}
                              dataKey={w.name}
                              stackId="warehouses"
                              fill={CHART_COLORS[i % CHART_COLORS.length]}
                              stroke="var(--card)"
                              strokeWidth={2}
                              maxBarSize={28}
                              radius={[4, 4, 4, 4]}
                              isAnimationActive={false}
                              {...(i === 0 ? { background: { fill: "var(--muted)", opacity: 0.35, radius: 8 } } : {})}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </PanelCard>
            </Section>

            <Section index={3}>
              <WarehouseMoversChart
                data={warehouseMovers}
                actions={
                  <Select value={moversWarehouseId} onValueChange={(v) => setMoversWarehouseId((v as string) ?? "all")}>
                    <SelectTrigger className="h-8 w-fit min-w-[176px] text-xs">
                      <SelectValue>
                        {moversWarehouseId === "all" ? "Tüm Depolar" : warehouses.find((w) => w.id === moversWarehouseId)?.name}
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
                }
              />
            </Section>
          </SectionStack>
        </TabsContent>

        {/* ── Hareketler ──────────────────────────────────────────────────── */}
        <TabsContent value="hareketler">
          <SectionStack>
            <Section index={0}>
              <PanelCard title="Hareket Dağılımı" meta={RANGE_LABELS[range]}>
                <div className="grid gap-5 lg:grid-cols-3 lg:gap-0">
                  <div className="grid grid-cols-3 gap-2 lg:pr-8">
                    <MovementStat icon={ArrowDownToLine} label="Giriş" count={inTypeStats?.count ?? 0} color="text-status-good" bg="bg-status-good/10" />
                    <MovementStat icon={ArrowUpFromLine} label="Çıkış" count={outTypeStats?.count ?? 0} color="text-status-critical" bg="bg-status-critical/10" />
                    <MovementStat icon={ArrowLeftRight} label="Transfer" count={transferTypeStats?.count ?? 0} color="text-primary" bg="bg-primary/10" />
                  </div>
                  <div className="border-t border-border pt-5 lg:border-t-0 lg:border-l lg:px-8 lg:pt-0">
                    <MovementDistributionChart
                      data={[
                        { key: "giris", label: "Giriş", percent: inPercent, count: inTypeStats?.count ?? 0 },
                        { key: "cikis", label: "Çıkış", percent: outPercent, count: outTypeStats?.count ?? 0 },
                        { key: "transfer", label: "Transfer", percent: transferPercent, count: transferTypeStats?.count ?? 0 },
                      ]}
                    />
                  </div>
                  <div className="space-y-2 border-t border-border pt-5 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0">
                    <p className="text-micro font-medium uppercase tracking-wide text-muted-foreground">Dönem Toplamları</p>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Toplam Giriş</span>
                      <span className="font-semibold tabular-nums text-status-good">
                        +{formatNumber(inTypeStats?.totalQuantity ?? 0)} adet
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Toplam Çıkış</span>
                      <span className="font-semibold tabular-nums text-status-critical">
                        -{formatNumber(outTypeStats?.totalQuantity ?? 0)} adet
                      </span>
                    </div>
                  </div>
                </div>
              </PanelCard>
            </Section>

            <Section index={1} className="grid gap-4">
              <MovementTable
                movements={inMovements}
                products={products}
                type="giris"
                meta={`${inTypeStats?.count ?? 0} kayıt`}
                actions={
                  <Link href="/stok/islem" className="flex items-center gap-1 text-xs text-primary hover:underline">
                    Giriş yap <ChevronRight className="size-3.5" />
                  </Link>
                }
              />
              <MovementTable
                movements={outMovements}
                products={products}
                type="cikis"
                meta={`${outTypeStats?.count ?? 0} kayıt`}
                actions={
                  <Link href="/stok/islem" className="flex items-center gap-1 text-xs text-primary hover:underline">
                    Çıkış yap <ChevronRight className="size-3.5" />
                  </Link>
                }
              />
            </Section>

            <Section index={2}>
              <MovementTable
                movements={transferMovements}
                products={products}
                type="transfer"
                meta={`${transferTypeStats?.count ?? 0} kayıt`}
                actions={
                  <Link href="/stok/hareketler" className="flex items-center gap-1 text-xs text-primary hover:underline">
                    Tüm hareketler <ChevronRight className="size-3.5" />
                  </Link>
                }
              />
            </Section>
          </SectionStack>
        </TabsContent>

        {/* ── Satın Alma ──────────────────────────────────────────────────── */}
        <TabsContent value="satin-alma">
          <Section index={0} className="grid items-start gap-4 lg:grid-cols-[1fr_280px]">
            <PanelCard
              title="Satın Alma Siparişleri"
              meta={`${filteredOrders.length} kayıt`}
              bodyClassName="pt-0"
              actions={
                <Link href="/satin-alma" className="flex items-center gap-1 text-xs text-primary hover:underline">
                  Siparişler <ChevronRight className="size-3.5" />
                </Link>
              }
            >
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border/70 hover:bg-transparent">
                      <TableHead className="px-3">Sipariş No</TableHead>
                      <TableHead className="px-3">Tedarikçi</TableHead>
                      <TableHead className="px-3">Durum</TableHead>
                      <TableHead className="px-3 text-right">Toplam ({symbol})</TableHead>
                      <TableHead className="px-3 whitespace-nowrap">Tarih</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOrders.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="p-0">
                          <EmptyState icon={ShoppingCart} title="Seçili dönemde sipariş yok" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedOrders.map((po) => {
                        const supplier = suppliers.find((s) => s.id === po.supplierId);
                        const total = po.total;
                        return (
                          <TableRow key={po.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                            <TableCell className="px-3 font-mono text-xs font-semibold">{po.code}</TableCell>
                            <TableCell className="px-3 text-xs">{supplier?.name ?? "—"}</TableCell>
                            <TableCell className="px-3">
                              <PurchaseStatusBadge status={po.status} />
                            </TableCell>
                            <TableCell className="px-3 text-right text-xs font-semibold tabular-nums">
                              {formatCurrency(total / rate, currency, 1, true)}
                            </TableCell>
                            <TableCell className="px-3 whitespace-nowrap text-xs text-muted-foreground">
                              {formatDateTime(po.createdAt)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {totalPurchasePages > 1 && (
                <div className="mt-4 flex items-center justify-start gap-4 border-t border-border/50 pt-4 text-xs">
                  <span className="text-muted-foreground">
                    Toplam {filteredOrders.length} kayıttan {(purchasePage - 1) * purchasePageSize + 1}-
                    {Math.min(purchasePage * purchasePageSize, filteredOrders.length)} arası gösteriliyor
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={purchasePage === 1}
                      onClick={() => setPurchasePage(1)}
                      title="İlk Sayfa"
                    >
                      <ChevronsLeft className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={purchasePage === 1}
                      onClick={() => setPurchasePage((p) => Math.max(1, p - 1))}
                      title="Önceki Sayfa"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={purchasePage === totalPurchasePages}
                      onClick={() => setPurchasePage((p) => Math.min(totalPurchasePages, p + 1))}
                      title="Sonraki Sayfa"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={purchasePage === totalPurchasePages}
                      onClick={() => setPurchasePage(totalPurchasePages)}
                      title="Son Sayfa"
                    >
                      <ChevronsRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </PanelCard>

            <div className="flex flex-col gap-4">
              <PanelCard title="Sipariş Durumları" bodyClassName="flex flex-col items-center justify-start pt-2">
                {orderStatusData.length === 0 ? (
                  <EmptyState icon={ShoppingCart} title="Veri yok" />
                ) : (
                  <div className="w-full space-y-3">
                    <div className="min-h-[160px] w-full">
                      <ResponsiveContainer width="100%" height="100%" minHeight={160}>
                        <PieChart>
                          <Pie data={orderStatusData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={4} dataKey="value" cornerRadius={5} stroke="none">
                            {orderStatusData.map((_, i) => (
                              <Cell 
                                key={i} 
                                fill={CHART_COLORS[i % CHART_COLORS.length]} 
                                className="transition-all duration-300 ease-out hover:scale-110 hover:drop-shadow-md cursor-pointer outline-none"
                                style={{ transformOrigin: "50% 50%", transformBox: "fill-box" } as React.CSSProperties}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            cursor={false}
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0].payload as (typeof orderStatusData)[0];
                              return (
                                <ChartTooltip
                                  title={d.name}
                                  rows={[{ label: "Sipariş", color: CHART_COLORS[0], value: String(d.value) }]}
                                />
                              );
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-1.5 px-1">
                      {orderStatusData.map((d, i) => (
                        <div key={d.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <ChartSwatch color={CHART_COLORS[i % CHART_COLORS.length]} />
                            <span className="text-muted-foreground">{d.name}</span>
                          </div>
                          <span className="font-semibold tabular-nums text-foreground">{d.value}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </PanelCard>

              <PanelCard title="En Çok Sipariş" bodyClassName="flex flex-col pt-2">
                {topSuppliersData.length === 0 ? (
                  <EmptyState icon={ShoppingCart} title="Veri yok" />
                ) : (
                  <div className="w-full space-y-4">
                    {topSuppliersData.map((d, i) => (
                      <div key={d.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground truncate max-w-[140px]">{d.name}</span>
                          <span className="text-muted-foreground tabular-nums">{formatCurrency(d.total, currency, 0, true)}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div 
                            className="h-full rounded-full transition-all duration-500 ease-out" 
                            style={{ 
                              width: `${(d.total / topSuppliersData[0].total) * 100}%`,
                              backgroundColor: CHART_COLORS[i % CHART_COLORS.length] 
                            }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </PanelCard>

              <PanelCard 
                title="Aylık Satın Alma Trendi" 
                className="overflow-visible"
                bodyClassName="flex flex-col pt-2 overflow-visible"
              >
                {monthlyPurchaseTrend.length === 0 ? (
                  <EmptyState icon={ShoppingCart} title="Veri yok" />
                ) : (
                  <div className="w-full space-y-3">
                    {/* Summary KPIs */}
                    <div className="grid grid-cols-2 gap-2 px-1">
                      <div className="flex h-14 flex-col items-center justify-center rounded-lg border border-border/60 bg-muted/30 px-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground">Toplam Sipariş</p>
                        <p className="text-sm font-bold tabular-nums text-foreground">
                          {monthlyPurchaseTrend.reduce((s, r) => s + (r.count as number), 0)}
                        </p>
                      </div>
                      <div className="flex h-14 flex-col items-center justify-center rounded-lg border border-border/60 bg-muted/30 px-1 text-center">
                        <p className="w-full text-[10px] text-muted-foreground">Toplam Tutar</p>
                        <p className="w-full whitespace-nowrap text-[10px] font-bold tabular-nums tracking-tighter text-foreground">
                          {formatCurrency(monthlyPurchaseTrend.reduce((s, r) => s + (r.total as number), 0), currency, 0, true)}
                        </p>
                      </div>
                    </div>

                    {/* Stacked Bar Chart */}
                    <div className="min-h-[180px] w-full">
                      <ResponsiveContainer width="100%" height="100%" minHeight={180}>
                        <BarChart data={monthlyPurchaseTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" opacity={0.4} />
                          <XAxis 
                            dataKey="name" 
                            tickLine={false} 
                            axisLine={false} 
                            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} 
                            dy={8}
                          />
                          <Tooltip
                            cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                            position={{ x: -240, y: -20 }}
                            allowEscapeViewBox={{ x: true, y: true }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0]?.payload as Record<string, string | number>;
                              const rows = monthlyTrendStatuses
                                .filter((status) => (d[status] as number) > 0)
                                .map((status, i) => ({
                                  label: status,
                                  color: CHART_COLORS[i % CHART_COLORS.length],
                                  value: formatCurrency(d[status] as number, currency, 0, true),
                                }));
                              rows.push({ label: "Toplam", color: "var(--foreground)", value: formatCurrency(d.total as number, currency, 0, true) });
                              return (
                                <ChartTooltip
                                  title={`${d.name} · ${d.count} sipariş`}
                                  rows={rows}
                                />
                              );
                            }}
                          />
                          {monthlyTrendStatuses.map((status, i) => (
                            <Bar 
                              key={status}
                              dataKey={status} 
                              stackId="1"
                              fill={CHART_COLORS[i % CHART_COLORS.length]} 
                              radius={
                                // If it's the last item in the stack, we might want top rounded corners, but in a dynamic stack it's hard to know which is top.
                                // We can leave radius 0 or just round all bars slightly.
                                [2, 2, 0, 0]
                              }
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
                      {monthlyTrendStatuses.map((status, i) => (
                        <div key={status} className="flex items-center gap-1.5 text-[10px]">
                          <ChartSwatch color={CHART_COLORS[i % CHART_COLORS.length]} />
                          <span className="text-muted-foreground">{status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </PanelCard>
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
    </Can>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────

function MovementStat({ icon: Icon, label, count, color, bg }: {
  icon: React.ElementType;
  label: string;
  count: number;
  color: string;
  bg: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={cn("flex size-8 items-center justify-center rounded-lg", bg)}>
        <Icon className={cn("size-4", color)} />
      </div>
      <p className={cn("text-xl font-bold tabular-nums", color)}>{formatNumber(count)}</p>
      <p className="text-micro text-muted-foreground">{label}</p>
    </div>
  );
}

/** Semantic per-type color — matches `MovementStat`'s tint tokens for the same three categories. */
const MOVEMENT_DIST_COLORS: Record<string, string> = {
  giris: "var(--status-good)",
  cikis: "var(--status-critical)",
  transfer: "var(--primary)",
};

function MovementDistributionTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fontWeight={500} fill="var(--muted-foreground)">
      {payload?.value}
    </text>
  );
}

interface MovementDistDatum {
  key: string;
  label: string;
  percent: number;
  count: number;
}

function MovementDistributionChart({ data }: { data: MovementDistDatum[] }) {
  return (
    <div className="h-[116px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 56, top: 2, bottom: 2 }} barCategoryGap="32%">
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis type="category" dataKey="label" width={64} tickLine={false} axisLine={false} tick={<MovementDistributionTick />} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.35 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as MovementDistDatum;
              return (
                <ChartTooltip
                  title={d.label}
                  rows={[{ label: "Hareket", color: MOVEMENT_DIST_COLORS[d.key], value: `${formatNumber(d.count)} (%${d.percent})` }]}
                />
              );
            }}
          />
          <Bar dataKey="percent" radius={[0, 6, 6, 0]} maxBarSize={14} animationDuration={500}>
            {data.map((d) => (
              <Cell key={d.key} fill={MOVEMENT_DIST_COLORS[d.key]} />
            ))}
            <LabelList
              dataKey="percent"
              content={(props: LabelProps) => {
                const d = data[Number(props.index ?? 0)];
                if (!d) return null;
                const cx = Number(props.x ?? 0) + Number(props.width ?? 0) + 8;
                const cy = Number(props.y ?? 0) + Number(props.height ?? 0) / 2;
                return (
                  <text x={cx} y={cy} dy={4} fontSize={11} fontWeight={700} fill="var(--foreground)">
                    {`${formatNumber(d.count)} · %${d.percent}`}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Ranked magnitude comparison for the highest-volume products.
 *
 * Two deliberate choices, both correcting earlier versions of this panel:
 *
 * 1. No Y-axis. A 120px axis truncated product names to unreadable stubs
 *    ("HP ZBook Fury 1…"). Each product is its own labelled row instead, so
 *    the name gets the panel's full width.
 * 2. One hue for every bar, not a colour per bar. Products are nominal — they
 *    have no natural order — so cycling hues by rank double-encodes bar length
 *    as colour and spends the only free channel on information the bar already
 *    shows.
 *
 * Every bar is drawn at full strength and every row keeps foreground text:
 * fading the non-leaders made eight of nine rows read as disabled. The rank
 * number and the bar length already carry the ordering, so the leader needs
 * nothing louder than a heavier font weight.
 */
function MoversChart({
  title,
  icon: Icon,
  data,
}: {
  title: string;
  icon: LucideIcon;
  data: ReportMover[];
}) {
  return (
    <PanelCard
      title={
        <span className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </span>
      }
      meta={data.length > 0 ? `${data.length} ürün` : undefined}
    >
      {data.length === 0 ? (
        <EmptyState icon={Icon} title="Veri yok" />
      ) : (
        <div className="max-h-[340px] overflow-y-auto custom-scrollbar">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="border-b border-border/70 hover:bg-transparent">
                <TableHead className="w-[46%] px-2">Ürün</TableHead>
                <TableHead className="w-[22%] px-2">SKU</TableHead>
                <TableHead className="w-[16%] px-2 text-center">Hareket</TableHead>
                <TableHead className="w-[16%] px-2 text-center">Miktar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.productId} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <TableCell className="px-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <ProductImageThumbnail src={item.imageUrl} alt={item.name} size="xs" />
                      <Link
                        href={`/urunler/${item.productId}`}
                        className="block truncate text-xs font-semibold text-foreground hover:underline"
                        title={item.name}
                      >
                        {item.name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="px-2">
                    <span className="block truncate font-mono text-micro text-muted-foreground" title={item.sku}>
                      {item.sku}
                    </span>
                  </TableCell>
                  <TableCell className="px-2 text-center tabular-nums text-xs text-muted-foreground">
                    {formatNumber(item.movementCount)}
                  </TableCell>
                  <TableCell className="px-2 text-center">
                    <span className="inline-block rounded-md bg-muted/70 px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground">
                      {formatNumber(item.totalQuantity)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PanelCard>
  );
}

/**
 * Stagnant-inventory watchlist, not a magnitude comparison. `leastMovers` is
 * the ascending tail of the movers list — every value clustered near zero and
 * nearly identical — so a bar/progress form (this panel's earlier shape)
 * renders eight near-indistinguishable stubs. A plain list table reads the
 * exact counts instead of asking the reader to compare bar lengths that all
 * look the same. No rank badge: coming in "1st" among the least-moved
 * products isn't an achievement, so a podium chip would misread as one.
 */
function LeastMoversList({ items }: { items: ReportMover[] }) {
  return (
    <PanelCard
      title={
        <span className="flex items-center gap-2">
          <TrendingDown className="size-4 text-muted-foreground" />
          En Az Hareket Gören Ürünler
        </span>
      }
      meta={items.length > 0 ? `${items.length} ürün` : undefined}
    >
      {items.length === 0 ? (
        <EmptyState icon={TrendingDown} title="Veri yok" />
      ) : (
        <div className="max-h-[340px] overflow-y-auto custom-scrollbar">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="border-b border-border/70 hover:bg-transparent">
                <TableHead className="w-[46%] px-2">Ürün</TableHead>
                <TableHead className="w-[22%] px-2">SKU</TableHead>
                <TableHead className="w-[16%] px-2 text-center">Hareket</TableHead>
                <TableHead className="w-[16%] px-2 text-center">Miktar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.productId} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <TableCell className="px-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <ProductImageThumbnail src={item.imageUrl} alt={item.name} size="xs" />
                      <Link
                        href={`/urunler/${item.productId}`}
                        className="block truncate text-xs font-semibold text-foreground hover:underline"
                        title={item.name}
                      >
                        {item.name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="px-2">
                    <span className="block truncate font-mono text-micro text-muted-foreground" title={item.sku}>
                      {item.sku}
                    </span>
                  </TableCell>
                  <TableCell className="px-2 text-center tabular-nums text-xs text-muted-foreground">
                    {formatNumber(item.movementCount)}
                  </TableCell>
                  <TableCell className="px-2 text-center">
                    <span className="inline-block rounded-md bg-muted/70 px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground">
                      {formatNumber(item.totalQuantity)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PanelCard>
  );
}

function MovementTable({
  movements,
  products,
  type,
  meta,
  actions,
}: {
  movements: StockMovement[];
  products: { id: string; name: string; imageUrl?: string }[];
  type: "giris" | "cikis" | "transfer";
  meta?: string;
  actions?: React.ReactNode;
}) {
  return (
    <PanelCard
      title={MOVEMENT_TYPE_LABELS[type]}
      meta={movements.length > 0 ? meta : undefined}
      actions={actions}
    >
      {movements.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Kayıt yok"
          description={`Seçili dönemde ${MOVEMENT_TYPE_LABELS[type].toLocaleLowerCase("tr-TR")} hareketi yok.`}
        />
      ) : (
        <div className="max-h-[340px] overflow-y-auto custom-scrollbar pr-3">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/70 hover:bg-transparent">
                <TableHead className="px-3 whitespace-nowrap">Tarih</TableHead>
                <TableHead className="px-3">Ürün</TableHead>
                <TableHead className="px-3">Sebep</TableHead>
                <TableHead className="px-3 text-right">Miktar</TableHead>
                <TableHead className="px-3 text-right whitespace-nowrap">Önceki → Yeni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((m) => {
                const product = products.find((p) => p.id === m.productId);
                const signed = type === "cikis" ? -m.quantity : m.quantity;
                return (
                  <TableRow key={m.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                    <TableCell className="px-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(m.createdAt)}
                    </TableCell>
                    <TableCell className="px-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <ProductImageThumbnail src={product?.imageUrl} alt={product?.name ?? ""} size="xs" />
                        <Link href={`/urunler/${m.productId}`} className="max-w-[150px] truncate text-xs font-medium text-foreground hover:underline">
                          {product?.name ?? "—"}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 text-xs text-muted-foreground">
                      {MOVEMENT_REASON_LABELS[m.reason] ?? "—"}
                    </TableCell>
                    <TableCell className={cn("px-3 text-right text-xs font-semibold tabular-nums", MOVEMENT_TYPE_COLOR[type])}>
                      {formatSigned(signed)}
                    </TableCell>
                    <TableCell className="px-3 text-right text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                      {formatNumber(m.previousQuantity)} → {formatNumber(m.newQuantity)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </PanelCard>
  );
}

function Forbidden() {
  return (
    <div className="space-y-6">
      <PageHeader title="Raporlar" />
      <ForbiddenState message="Raporları görüntülemek için yetkiniz yok." />
    </div>
  );
}
