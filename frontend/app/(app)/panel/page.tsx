"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Package,
  Warehouse,
  ArrowDownToLine,
  ArrowUpFromLine,
  ShoppingCart,
  Clock,
  Wallet,
  XCircle,
  Boxes,
  Truck,
  Users,
  AlertTriangle,
  Layers,
  Download,
  FileSpreadsheet,
  FileText,
  X,
  Loader2,
  Check,
  Database,
  Building2,
  Tag,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { KpiPanel } from "@/components/dashboard/kpi-panel";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { StockFlowChart } from "@/components/dashboard/stock-flow-chart";
import { CategoryRadialChart } from "@/components/dashboard/category-radial-chart";
import { WarehouseStockBars } from "@/components/dashboard/warehouse-stock-bars";
import { CriticalStockList } from "@/components/dashboard/critical-stock-list";
import { RecentMovementsTable } from "@/components/dashboard/recent-movements-table";
import { TopMoversList } from "@/components/dashboard/top-movers-list";
import { useAsync } from "@/lib/hooks/use-async";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { getDashboardData, RANGE_LABELS, type DateRangePreset } from "@/lib/api/dashboard";
import { buildReportData } from "@/lib/export/report-data";
import { downloadBlob, reportFilename, slugify } from "@/lib/export/download";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useCurrency } from "@/lib/currency-context";

const REPORT_SECTIONS = [
  { id: "all", label: "Tüm Rapor (Tam Döküm)", desc: "KPI özetleri, stok hareketleri, depolar ve tüm ürünler." },
  { id: "kpi", label: "Dashboard & KPI Özeti", desc: "Yalnızca üst panel sayısal metrikleri." },
  { id: "critical", label: "Kritik Stok Listesi", desc: "Minimum stok seviyesinin altındaki ürünler." },
  { id: "movements", label: "Stok Hareketleri", desc: "Tüm giriş, çıkış ve depolar arası transfer kayıtları." },
  { id: "warehouse", label: "Depo Bazında Stok", desc: "Depo doluluk oranları ve birim kapasiteleri." },
  { id: "products", label: "Ürün Kataloğu", desc: "Katalogdaki tüm aktif ürünler ve mevcut stok miktarları." },
];

const ALL_SPECIFIC_IDS = ["kpi", "critical", "movements", "warehouse", "products"];

export default function PanelPage() {
  const [range, setRange] = useState<DateRangePreset>("son-6-ay");
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedSections, setSelectedSections] = useState<string[]>(["all"]);

  const { status, data, staleData, error, refetch } = useAsync(() => getDashboardData(range), [range]);
  const view = data ?? staleData;

  const { name, role } = useAuth();
  const { currency, rates } = useCurrency();
  const excelGuard = useSubmitGuard();
  const pdfGuard = useSubmitGuard();
  const exporting = excelGuard.pending || pdfGuard.pending;
  const hasSelection = selectedSections.length > 0;

  const reportInput = () => buildReportData(range, `${name} (${ROLE_LABELS[role]})`, currency, rates?.[currency]);

  const toggleSection = (id: string) => {
    if (id === "all") {
      if (selectedSections.includes("all") || selectedSections.length === ALL_SPECIFIC_IDS.length) {
        setSelectedSections([]);
      } else {
        setSelectedSections(["all"]);
      }
      return;
    }

    let current = selectedSections.includes("all")
      ? [...ALL_SPECIFIC_IDS]
      : [...selectedSections];

    if (current.includes(id)) {
      current = current.filter((s) => s !== id);
    } else {
      current.push(id);
    }

    if (current.length === ALL_SPECIFIC_IDS.length) {
      setSelectedSections(["all"]);
    } else {
      setSelectedSections(current);
    }
  };

  function getCustomFilename(ext: "xlsx" | "pdf", date: Date) {
    let prefix = "stok-raporu";
    if (selectedSections.length === 1 && selectedSections[0] !== "all") {
      const section = REPORT_SECTIONS.find(s => s.id === selectedSections[0]);
      if (section) {
        prefix = slugify(section.label);
      }
    } else if (!selectedSections.includes("all")) {
      prefix = "ozel-rapor";
    }
    return reportFilename(ext, date, prefix);
  }

  async function exportExcel() {
    if (!hasSelection) return;
    await excelGuard.guard(async () => {
      try {
        const report = reportInput();
        const { buildReportExcel } = await import("@/lib/export/excel");
        const filename = getCustomFilename("xlsx", report.generatedAt);
        downloadBlob(buildReportExcel(report, selectedSections), filename);
        toast.success("Excel Raporu Başarıyla İndirildi 📊", {
          description: `Seçilen bölümler Excel (.xlsx) olarak kaydedildi.`,
        });
        setShowExportModal(false);
      } catch (err) {
        toast.error("Excel raporu oluşturulamadı", {
          description: err instanceof Error ? err.message : "Beklenmedik bir hata oluştu.",
        });
      }
    });
  }

  async function exportPdf() {
    if (!hasSelection) return;
    await pdfGuard.guard(async () => {
      try {
        const report = reportInput();
        const { buildReportPdf } = await import("@/lib/export/pdf");
        const filename = getCustomFilename("pdf", report.generatedAt);
        downloadBlob(await buildReportPdf(report, selectedSections), filename);
        toast.success("PDF Raporu Başarıyla İndirildi 📄", {
          description: `Seçilen bölümler tasarımlı PDF olarak kaydedildi.`,
        });
        setShowExportModal(false);
      } catch (err) {
        toast.error("PDF raporu oluşturulamadı", {
          description: err instanceof Error ? err.message : "Beklenmedik bir hata oluştu.",
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel"
        description="Şirket genelinde stok, satın alma ve depo özetini görün."
        actions={
          <>
            <Select
              value={range}
              onValueChange={(v) => {
                const preset = v as DateRangePreset;
                setRange(preset);
                toast.info("Tarih Filtresi Güncellendi", {
                  description: `Seçilen dönem: ${RANGE_LABELS[preset]}`,
                });
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RANGE_LABELS) as DateRangePreset[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {RANGE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {status === "error" && !view ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : !view ? (
        <DashboardSkeleton />
      ) : (
        <div className={status === "loading" ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <KpiPanel title="Stok Özeti" icon={Boxes}>
              <KpiTile icon={Package} tint="blue" label="Toplam Ürün" value={formatNumber(view.kpis.totalProducts)} />
              <KpiTile icon={Warehouse} tint="indigo" label="Toplam Depo" value={formatNumber(view.kpis.totalWarehouses)} />
              <KpiTile icon={ArrowDownToLine} tint="green" label="Bugünkü Giriş" value={formatNumber(view.kpis.todayIn)} />
              <KpiTile icon={ArrowUpFromLine} tint="orange" label="Bugünkü Çıkış" value={formatNumber(view.kpis.todayOut)} />
            </KpiPanel>

            <KpiPanel title="Satın Alma Özeti" icon={ShoppingCart}>
              <KpiTile icon={ShoppingCart} tint="cyan" label="Açık Sipariş" value={formatNumber(view.kpis.openPurchaseOrders)} />
              <KpiTile icon={Clock} tint="yellow" label="Bekleyen Teslimat" value={formatNumber(view.kpis.pendingDeliveries)} />
              <KpiTile icon={Wallet} tint="teal" label="Toplam Tutar" value={formatCurrency(view.kpis.purchaseTotalValue, currency, rates?.[currency] || 1)} />
              <KpiTile icon={XCircle} tint="red" label="İptal" value={formatNumber(view.kpis.cancelledOrders)} />
            </KpiPanel>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="shadow-soft border-border/70 py-5 gap-3">
              <CardHeader className="px-5 pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight text-foreground">
                  <Layers className="size-4 text-muted-foreground" />
                  Envanter Özeti
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 px-5 pt-2">
                <KpiTile icon={Database} tint="sky" label="Eldeki Miktar" value={formatNumber(view.kpis.onHandUnits)} />
                <KpiTile icon={Truck} tint="amber" label="Yolda" value={formatNumber(view.kpis.incomingUnits)} />
              </CardContent>
            </Card>

            <Card className="shadow-soft border-border/70 py-5 gap-3">
              <CardHeader className="px-5 pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight text-foreground">
                  <Users className="size-4 text-muted-foreground" />
                  Kullanıcı &amp; Tedarikçi
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 px-5 pt-2">
                <KpiTile icon={Users} tint="fuchsia" label="Toplam Kullanıcı" value={formatNumber(view.kpis.totalUsers)} />
                <KpiTile icon={Building2} tint="pink" label="Toplam Tedarikçi" value={formatNumber(view.kpis.totalSuppliers)} />
              </CardContent>
            </Card>

            <Card className="shadow-soft border-border/70 py-5 gap-3">
              <CardHeader className="px-5 pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight text-foreground">
                  <AlertTriangle className="size-4 text-muted-foreground" />
                  Stok Durumu
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-2 px-5 pt-2">
                <KpiTile icon={AlertTriangle} tint="red" label="Kritik Stok" value={formatNumber(view.kpis.criticalStockCount)} />
                <KpiTile icon={Layers} tint="violet" label="Kategori" value={formatNumber(view.kpis.categoryCount)} />
                <KpiTile icon={Tag} tint="indigo" label="Ürün Çeşidi" value={formatNumber(view.kpis.productVariantCount)} />
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-7 flex flex-col">
              <StockFlowChart data={view.monthlyFlow} />
            </div>
            <div className="lg:col-span-5 flex flex-col">
              <CategoryRadialChart shares={view.categoryShares} />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2">
            <WarehouseStockBars data={view.warehouseTotals} />
            <CriticalStockList items={view.criticalProducts} />
            <RecentMovementsTable items={view.recentMovements} />
            <TopMoversList items={view.topMovers} />
          </div>
        </div>
      )}


    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-[188px] rounded-xl" />
        <Skeleton className="h-[188px] rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-[132px] rounded-xl" />
        <Skeleton className="h-[132px] rounded-xl" />
        <Skeleton className="h-[132px] rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-[380px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[380px] rounded-xl" />
      </div>
    </div>
  );
}
