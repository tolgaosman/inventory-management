"use client";

import { useMemo, useState } from "react";
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
  PieChart,
  Pie,
  LabelList,
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
  CheckCircle2,
  Inbox,
  MapPin,
  Wallet,
  Boxes,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Section, SectionStack } from "@/components/common/section";
import { PanelCard } from "@/components/common/panel-card";
import { StatGrid } from "@/components/common/stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PurchaseStatusBadge } from "@/components/common/status-badge";
import { ProductImageThumbnail } from "@/components/common/product-image-thumbnail";
import { CHART_GRID, CHART_X_AXIS, CHART_Y_AXIS, ChartSwatch, ChartTooltip } from "@/components/charts/chart-primitives";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings-context";
import { useCurrency } from "@/lib/currency-context";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import { buildReportData, CURRENCY_SYMBOLS } from "@/lib/export/report-data";
import { buildReportExcel } from "@/lib/export/excel";
import { buildReportPdf } from "@/lib/export/pdf";
import { downloadBlob, reportFilename } from "@/lib/export/download";
import {
  getWarehouseDetails,
  getCategoryShares,
  getTopMovers,
  getCriticalProducts,
  getDashboardKpis,
} from "@/lib/mock/dashboard";
import { warehouses, products, stockMovements, purchaseOrders, purchaseOrderTotal, suppliers } from "@/lib/mock/data";
import { capacityIndicatorClass } from "@/lib/capacity";
import { formatNumber, formatCurrency, formatDateTime, formatSigned } from "@/lib/format";
import { MONTHS_BY_RANGE, RANGE_LABELS, type DateRangePreset } from "@/lib/api/dashboard";
import { MOVEMENT_TYPE_LABELS, MOVEMENT_REASON_LABELS, PURCHASE_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS: DateRangePreset[] = ["bu-ay", "son-3-ay", "son-6-ay", "bu-yil"];

type ReportTab = "urunler" | "depolar" | "hareketler" | "satin-alma";

const REPORT_TABS: { value: ReportTab; label: string; icon: React.ElementType }[] = [
  { value: "urunler", label: "Ürünler", icon: Package },
  { value: "depolar", label: "Depolar", icon: Warehouse },
  { value: "hareketler", label: "Hareketler", icon: ArrowLeftRight },
  { value: "satin-alma", label: "Satın Alma", icon: ShoppingCart },
];

const MOVEMENT_TYPE_COLOR: Record<string, string> = {
  giris: "text-status-good",
  cikis: "text-status-critical",
  transfer: "text-primary",
};

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function ReportsClient() {
  const { name } = useAuth();
  const { company } = useSettings();
  const { currency, rates } = useCurrency();
  const [range, setRange] = useState<DateRangePreset>("son-6-ay");
  const [tab, setTab] = useState<ReportTab>("urunler");
  const [moversWarehouseId, setMoversWarehouseId] = useState<string>("all");

  const rate = rates?.[currency] ?? 1;
  const months = MONTHS_BY_RANGE[range];
  const symbol = CURRENCY_SYMBOLS[currency];

  const kpis = useMemo(() => getDashboardKpis({ months }), [months]);
  const warehouseDetails = useMemo(() => getWarehouseDetails(), []);
  const warehouseCategoryShares = useMemo(
    () => warehouses.map((w) => ({ warehouseId: w.id, name: w.name, shares: getCategoryShares(w.id) })),
    [],
  );
  const warehouseMovers = useMemo(
    () => getTopMovers(8, moversWarehouseId === "all" ? undefined : moversWarehouseId),
    [moversWarehouseId],
  );
  const topMovers = useMemo(() => getTopMovers(10), []);
  const leastMovers = useMemo(
    () => [...getTopMovers(999)].sort((a, b) => a.totalQuantity - b.totalQuantity).slice(0, 10),
    [],
  );
  const criticalProducts = useMemo(() => getCriticalProducts(), []);

  const rangeStart = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [months]);

  const filteredMovements = useMemo(
    () => stockMovements.filter((m) => m.createdAt >= rangeStart).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [rangeStart],
  );
  const inMovements = filteredMovements.filter((m) => m.type === "giris");
  const outMovements = filteredMovements.filter((m) => m.type === "cikis");
  const transferMovements = filteredMovements.filter((m) => m.type === "transfer");

  const filteredOrders = useMemo(
    () => purchaseOrders.filter((po) => po.createdAt >= rangeStart).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [rangeStart],
  );

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

  const totalMovements = filteredMovements.length;
  const inPercent = totalMovements > 0 ? Math.round((inMovements.length / totalMovements) * 100) : 0;
  const outPercent = totalMovements > 0 ? Math.round((outMovements.length / totalMovements) * 100) : 0;
  const transferPercent = totalMovements > 0 ? Math.round((transferMovements.length / totalMovements) * 100) : 0;

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
    <div className="space-y-6">
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
            { icon: AlertTriangle, tint: "red", label: "Kritik Stok", value: formatNumber(kpis.criticalStockCount), emphasize: kpis.criticalStockCount > 0 },
            { icon: ArrowDownToLine, tint: "green", label: "Bugün Giriş", value: `${formatNumber(kpis.todayIn)} adet` },
            { icon: ArrowUpFromLine, tint: "amber", label: "Bugün Çıkış", value: `${formatNumber(kpis.todayOut)} adet` },
            { icon: ShoppingCart, tint: "teal", label: "Açık Sipariş", value: formatNumber(kpis.openPurchaseOrders) },
            { icon: Warehouse, tint: "plum", label: "Eldeki Miktar", value: `${formatNumber(kpis.onHandUnits)} adet` },
          ]}
        />
      </Section>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ReportTab)} className="gap-4">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto custom-scrollbar sm:w-fit">
          {REPORT_TABS.map(({ value, label, icon: Icon }) => (
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
                title="Kritik Stok"
                meta={criticalProducts.length > 0 ? `${criticalProducts.length} ürün` : undefined}
                actions={
                  <Link href="/urunler?stockStatus=kritik" className="flex items-center gap-1 text-xs text-primary hover:underline">
                    Ürünlerde gör <ChevronRight className="size-3.5" />
                  </Link>
                }
              >
                {criticalProducts.length === 0 ? (
                  <EmptyState icon={CheckCircle2} title="Kritik stok yok" description="Tüm ürünler minimum stok seviyesinin üzerinde." />
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

            {/* Yan yana depo karşılaştırması: kapasite, değer ve ürün çeşidini tek panelde gösterir. */}
            <Section index={1}>
              <div className="space-y-3">
                <h2 className="text-base font-semibold tracking-tight text-foreground">Depo Karşılaştırması</h2>
                {warehouseDetails.length === 0 ? (
                  <EmptyState icon={Warehouse} title="Depo verisi yok" />
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {warehouseDetails.map((w) => (
                      <Card key={w.warehouseId} className="border-border/70 bg-card">
                        <CardHeader className="p-4 pb-2">
                          <Badge variant="outline" className="mb-1 w-fit text-micro uppercase font-semibold text-primary bg-primary/10 border-primary/20">
                            <MapPin className="mr-1 inline-block size-3" />
                            {w.city}
                          </Badge>
                          <CardTitle className="text-sm font-semibold tracking-tight line-clamp-1">{w.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-2 space-y-3">
                          <div className="flex items-baseline justify-between text-xs font-semibold">
                            <span className="text-muted-foreground">Stok Miktarı:</span>
                            <span className="text-foreground">{formatNumber(w.units)} Adet</span>
                          </div>
                          <div className="flex items-baseline justify-between text-xs font-semibold">
                            <span className="text-muted-foreground">Ürün Çeşidi:</span>
                            <span className="text-foreground">{w.productCount} SKU</span>
                          </div>
                          <div className="flex items-baseline justify-between text-xs font-semibold">
                            <span className="text-muted-foreground">Toplam Değer:</span>
                            <span className="text-primary font-semibold">
                              {formatCurrency(w.totalValue / rate, currency, 1, true)}
                            </span>
                          </div>
                          <div className="space-y-1 pt-1 border-t border-border/40">
                            <div className="flex justify-between text-micro">
                              <span className="text-muted-foreground">Doluluk:</span>
                              <span className="font-semibold text-foreground">
                                %{w.capacityPercent} ({formatNumber(w.units)} / {formatNumber(w.capacity)})
                              </span>
                            </div>
                            <Progress value={w.capacityPercent} className="h-1.5">
                              <ProgressTrack className="h-1.5">
                                <ProgressIndicator className={capacityIndicatorClass(w.capacityPercent)} />
                              </ProgressTrack>
                            </Progress>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            <Section index={2} className="grid gap-4 lg:grid-cols-2">
              <PanelCard title="Depo Başına Envanter Değeri">
                {warehouseDetails.length === 0 ? (
                  <EmptyState icon={Wallet} title="Veri yok" />
                ) : (
                  <div className="min-h-[300px] w-full flex-1">
                    <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                      <BarChart data={warehouseDetails} margin={{ left: -8, right: 8, top: 24, bottom: 8 }} barCategoryGap="28%">
                        <defs>
                          {warehouseDetails.map((_, i) => (
                            <linearGradient key={i} id={`whValueGradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.95} />
                              <stop offset="100%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.45} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid {...CHART_GRID} />
                        <XAxis
                          dataKey="name"
                          {...CHART_X_AXIS}
                          tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 9) + "…" : v}
                        />
                        <YAxis
                          {...CHART_Y_AXIS}
                          tickFormatter={(v) => formatCurrency(v / rate, currency, 1, false)}
                        />
                        <Tooltip
                          cursor={{ fill: "var(--muted)", opacity: 0.35, radius: 8 }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload as (typeof warehouseDetails)[0];
                            return (
                              <ChartTooltip
                                title={d.name}
                                rows={[
                                  { label: "Envanter Değeri", color: CHART_COLORS[0], value: formatCurrency(d.totalValue / rate, currency, 1, true) },
                                  { label: "Ürün Çeşidi", color: CHART_COLORS[1], value: `${d.productCount} SKU`, divider: true },
                                ]}
                              />
                            );
                          }}
                        />
                        <Bar dataKey="totalValue" radius={[10, 10, 4, 4]} maxBarSize={56} animationDuration={600}>
                          {warehouseDetails.map((_, i) => (
                            <Cell key={i} fill={`url(#whValueGradient-${i})`} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={1} />
                          ))}
                          <LabelList
                            dataKey="totalValue"
                            position="top"
                            offset={10}
                            fill="var(--foreground)"
                            fontSize={11}
                            fontWeight={700}
                            formatter={(v) => formatCurrency(Number(v) / rate, currency, 1, false)}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </PanelCard>

              <PanelCard
                title="Depo Bazında Kategori Dağılımı"
                bodyClassName="flex flex-col"
              >
                {categoryByWarehouseData.length === 0 ? (
                  <EmptyState icon={Boxes} title="Veri yok" />
                ) : (
                  <>
                    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
                      {warehouses.map((w, i) => (
                        <span key={w.id} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <ChartSwatch color={CHART_COLORS[i % CHART_COLORS.length]} />
                          {w.name.length > 18 ? `${w.name.slice(0, 17)}…` : w.name}
                        </span>
                      ))}
                    </div>
                    <div className="min-h-[280px] w-full flex-1">
                      <ResponsiveContainer width="100%" height="100%" minHeight={280}>
                        <BarChart
                          data={categoryByWarehouseData}
                          layout="vertical"
                          margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
                          barGap={2}
                          barCategoryGap="22%"
                        >
                          <CartesianGrid {...CHART_GRID} vertical={false} horizontal={false} />
                          <XAxis type="number" {...CHART_X_AXIS} tickFormatter={(v) => formatNumber(v)} width={50} />
                          <YAxis
                            type="category"
                            dataKey="category"
                            width={110}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 500 }}
                            tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 13) + "…" : v)}
                          />
                          <Tooltip
                            cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null;
                              return (
                                <ChartTooltip
                                  title={String(label)}
                                  rows={warehouses.map((w, i) => ({
                                    label: w.name,
                                    color: CHART_COLORS[i % CHART_COLORS.length],
                                    value: formatNumber(Number(payload.find((p) => p.dataKey === w.name)?.value ?? 0)),
                                  }))}
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
                              opacity={0.9}
                              stroke="var(--card)"
                              strokeWidth={2}
                              maxBarSize={22}
                              radius={i === warehouses.length - 1 ? [0, 6, 6, 0] : i === 0 ? [6, 0, 0, 6] : undefined}
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
              <PanelCard
                title="Depo Bazında En Çok Hareket Gören Ürünler"
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
              >
                {warehouseMovers.length === 0 ? (
                  <EmptyState icon={TrendingUp} title="Hareket verisi yok" />
                ) : (
                  <div className="min-h-[300px] w-full flex-1">
                    <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                      <BarChart data={warehouseMovers} layout="vertical" margin={{ left: 0, right: 44, top: 4, bottom: 4 }} barCategoryGap="26%">
                        <defs>
                          {warehouseMovers.map((_, i) => (
                            <linearGradient key={i} id={`moverGradient-${i}`} x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.5} />
                              <stop offset="100%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.95} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid {...CHART_GRID} vertical={false} horizontal={false} />
                        <XAxis type="number" {...CHART_X_AXIS} tickFormatter={(v) => formatNumber(v)} width={50} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={140}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 500 }}
                          tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 17) + "…" : v)}
                        />
                        <Tooltip
                          cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload as (typeof warehouseMovers)[0];
                            return (
                              <ChartTooltip
                                title={d.name}
                                rows={[
                                  { label: "Toplam Miktar", color: CHART_COLORS[0], value: formatNumber(d.totalQuantity) },
                                  { label: "Hareket Sayısı", color: CHART_COLORS[1], value: formatNumber(d.movementCount), divider: true },
                                ]}
                              />
                            );
                          }}
                        />
                        <Bar dataKey="totalQuantity" radius={[0, 8, 8, 0]} maxBarSize={22} animationDuration={600}>
                          {warehouseMovers.map((_, i) => (
                            <Cell key={i} fill={`url(#moverGradient-${i})`} />
                          ))}
                          <LabelList
                            dataKey="totalQuantity"
                            position="right"
                            offset={8}
                            fill="var(--foreground)"
                            fontSize={11}
                            fontWeight={700}
                            formatter={(v) => formatNumber(Number(v))}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </PanelCard>
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
                    <MovementStat icon={ArrowDownToLine} label="Giriş" count={inMovements.length} color="text-status-good" bg="bg-status-good/10" />
                    <MovementStat icon={ArrowUpFromLine} label="Çıkış" count={outMovements.length} color="text-status-critical" bg="bg-status-critical/10" />
                    <MovementStat icon={ArrowLeftRight} label="Transfer" count={transferMovements.length} color="text-primary" bg="bg-primary/10" />
                  </div>
                  <div className="space-y-3 border-t border-border pt-5 lg:border-t-0 lg:border-l lg:px-8 lg:pt-0">
                    <MiniBar label="Giriş" percent={inPercent} color="bg-status-good" count={inMovements.length} />
                    <MiniBar label="Çıkış" percent={outPercent} color="bg-status-critical" count={outMovements.length} />
                    <MiniBar label="Transfer" percent={transferPercent} color="bg-primary" count={transferMovements.length} />
                  </div>
                  <div className="space-y-2 border-t border-border pt-5 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0">
                    <p className="text-micro font-medium uppercase tracking-wide text-muted-foreground">Dönem Toplamları</p>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Toplam Giriş</span>
                      <span className="font-semibold tabular-nums text-status-good">
                        +{formatNumber(inMovements.reduce((s, m) => s + m.quantity, 0))} adet
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Toplam Çıkış</span>
                      <span className="font-semibold tabular-nums text-status-critical">
                        -{formatNumber(outMovements.reduce((s, m) => s + m.quantity, 0))} adet
                      </span>
                    </div>
                  </div>
                </div>
              </PanelCard>
            </Section>

            <Section index={1} className="grid gap-4">
              <MovementTable
                movements={inMovements.slice(0, 30)}
                type="giris"
                meta={`${inMovements.length} kayıt`}
                actions={
                  <Link href="/stok/islem" className="flex items-center gap-1 text-xs text-primary hover:underline">
                    Giriş yap <ChevronRight className="size-3.5" />
                  </Link>
                }
              />
              <MovementTable
                movements={outMovements.slice(0, 30)}
                type="cikis"
                meta={`${outMovements.length} kayıt`}
                actions={
                  <Link href="/stok/islem" className="flex items-center gap-1 text-xs text-primary hover:underline">
                    Çıkış yap <ChevronRight className="size-3.5" />
                  </Link>
                }
              />
            </Section>

            <Section index={2}>
              <MovementTable
                movements={transferMovements.slice(0, 20)}
                type="transfer"
                meta={`${transferMovements.length} kayıt`}
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
        <TabsContent value="satin-alma" className="h-[calc(100dvh-270px)] min-h-[400px]">
          <Section index={0} className="grid h-full gap-4 lg:grid-cols-[1fr_280px]">
            <PanelCard
              title="Satın Alma Siparişleri"
              meta={`${filteredOrders.length} kayıt`}
              className="flex h-full flex-col"
              bodyClassName="flex flex-col flex-1 min-h-0 pt-0"
              actions={
                <Link href="/satin-alma" className="flex items-center gap-1 text-xs text-primary hover:underline">
                  Siparişler <ChevronRight className="size-3.5" />
                </Link>
              }
            >
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-3">
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
                    {filteredOrders.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="p-0">
                          <EmptyState icon={ShoppingCart} title="Seçili dönemde sipariş yok" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredOrders.map((po) => {
                        const supplier = suppliers.find((s) => s.id === po.supplierId);
                        const total = purchaseOrderTotal(po);
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
            </PanelCard>

            <PanelCard title="Sipariş Durumları" className="self-start" bodyClassName="flex flex-col items-center justify-start pt-2">
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
          </Section>
        </TabsContent>
      </Tabs>
    </div>
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

function MiniBar({ label, percent, color, count }: {
  label: string;
  percent: number;
  color: string;
  count: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium text-foreground">{count} · %{percent}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${percent}%` }} />
      </div>
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
  data: ReturnType<typeof getTopMovers>;
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
function LeastMoversList({ items }: { items: ReturnType<typeof getTopMovers> }) {
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
  type,
  meta,
  actions,
}: {
  movements: typeof stockMovements;
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
