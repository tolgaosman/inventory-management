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
import { downloadBlob, reportFilename } from "@/lib/export/download";
import { formatCurrency, formatNumber } from "@/lib/format";

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
  const excelGuard = useSubmitGuard();
  const pdfGuard = useSubmitGuard();
  const exporting = excelGuard.pending || pdfGuard.pending;
  const hasSelection = selectedSections.length > 0;

  const reportInput = () => buildReportData(range, `${name} (${ROLE_LABELS[role]})`);

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

  async function exportExcel() {
    if (!hasSelection) return;
    await excelGuard.guard(async () => {
      try {
        const report = reportInput();
        const { buildReportExcel } = await import("@/lib/export/excel");
        const filename = reportFilename("xlsx", report.generatedAt);
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
        const filename = reportFilename("pdf", report.generatedAt);
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExportModal(true)}
            >
              <Download className="size-4" />
              Dışa Aktar
            </Button>
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
              <KpiTile icon={Wallet} tint="teal" label="Toplam Tutar" value={formatCurrency(view.kpis.purchaseTotalValue)} />
              <KpiTile icon={XCircle} tint="red" label="İptal" value={formatNumber(view.kpis.cancelledOrders)} />
            </KpiPanel>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="shadow-soft border-border/70 py-5 gap-3">
              <CardHeader className="px-5 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
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
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
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
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
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

      {/* Export Selection & Format Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg bg-background shadow-2xl border border-border/80 rounded-2xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/60">
              <div>
                <CardTitle className="text-base font-bold text-foreground">Dışa Aktarma Seçenekleri</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  İndirmek istediğiniz içeriği seçin (birden fazla seçebilirsiniz).
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => setShowExportModal(false)}
              >
                <X className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {/* Step 1: Select Content (Multi-select Checkboxes) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    1. İndirilecek İçerikleri Seçin
                  </label>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {selectedSections.includes("all")
                      ? `${REPORT_SECTIONS.length - 1} / ${REPORT_SECTIONS.length - 1} seçili`
                      : `${selectedSections.length} / ${REPORT_SECTIONS.length - 1} seçili`}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                  {REPORT_SECTIONS.map((sec) => {
                    const isSelected = sec.id === "all"
                      ? selectedSections.includes("all") || selectedSections.length === ALL_SPECIFIC_IDS.length
                      : selectedSections.includes("all") || selectedSections.includes(sec.id);

                    return (
                      <button
                        key={sec.id}
                        type="button"
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                            : "border-border/60 bg-card hover:bg-muted/50 text-foreground"
                        }`}
                        onClick={() => toggleSection(sec.id)}
                      >
                        <div className={`size-4 rounded border flex items-center justify-center mt-0.5 shrink-0 ${
                          isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                        }`}>
                          {isSelected && <Check className="size-3 stroke-[3]" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold leading-tight truncate">{sec.label}</p>
                          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 line-clamp-1">{sec.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {!hasSelection && (
                  <p className="text-xs font-medium text-amber-500 mt-2 flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5" />
                    Lütfen indirmek için en az 1 içerik seçin.
                  </p>
                )}
              </div>

              {/* Step 2: Select Format Actions (Excel & PDF) */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                  2. Dosya Formatını Seçin ve İndirin
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={exporting || !hasSelection}
                    className="flex items-center gap-3.5 p-3.5 rounded-xl border border-border/70 bg-card hover:border-emerald-500/60 hover:bg-emerald-500/5 transition-all text-left group cursor-pointer disabled:pointer-events-none disabled:opacity-40"
                    onClick={exportExcel}
                  >
                    <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
                      {excelGuard.pending ? <Loader2 className="size-5 animate-spin" /> : <FileSpreadsheet className="size-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">Excel Tablosu (.xlsx)</p>
                      <p className="text-xs text-muted-foreground">Auto-fit, BOLD & All Borders</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={exporting || !hasSelection}
                    className="flex items-center gap-3.5 p-3.5 rounded-xl border border-border/70 bg-card hover:border-rose-500/60 hover:bg-rose-500/5 transition-all text-left group cursor-pointer disabled:pointer-events-none disabled:opacity-40"
                    onClick={exportPdf}
                  >
                    <div className="flex size-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform shrink-0">
                      {pdfGuard.pending ? <Loader2 className="size-5 animate-spin" /> : <FileText className="size-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">PDF Raporu (.pdf)</p>
                      <p className="text-xs text-muted-foreground">Tasarımlı Rapor Belgesi</p>
                    </div>
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
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
