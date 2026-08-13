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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { KpiPanel } from "@/components/dashboard/kpi-panel";
import { KpiTablePanel } from "@/components/dashboard/kpi-table-panel";
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
import { ROLE_LABELS, REPORT_SECTIONS, ALL_SPECIFIC_IDS } from "@/lib/constants";
import { getDashboardData, RANGE_LABELS, type DateRangePreset } from "@/lib/api/dashboard";
import { buildReportData } from "@/lib/export/report-data";
import { downloadBlob, reportFilename, slugify } from "@/lib/export/download";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useCurrency } from "@/lib/currency-context";
import { useSettings } from "@/lib/settings-context";

export default function PanelPage() {
  const { company, defaultRange, showKurus } = useSettings();
  const [range, setRange] = useState<DateRangePreset>(defaultRange);
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

  const reportInput = () =>
    buildReportData(range, `${name} (${ROLE_LABELS[role]})`, currency, rates?.[currency], company.companyName);

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
        toast.success("Excel Raporu Başarıyla İndirildi", {
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
        toast.success("PDF Raporu Başarıyla İndirildi", {
          description: `Seçilen bölümler PDF olarak kaydedildi.`,
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
                <SelectValue>{RANGE_LABELS[range]}</SelectValue>
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
            <KpiTablePanel
              title="Stok Özeti"
              icon={Boxes}
              items={[
                { icon: Package, tint: "blue", label: "Toplam Stok Miktarı", value: `${formatNumber(view.kpis.onHandUnits)} Adet` },
                { icon: Warehouse, tint: "indigo", label: "Toplam Depo", value: formatNumber(view.kpis.totalWarehouses) },
                { icon: ArrowDownToLine, tint: "green", label: "Bugünkü Giriş", value: formatNumber(view.kpis.todayIn) },
                { icon: ArrowUpFromLine, tint: "orange", label: "Bugünkü Çıkış", value: formatNumber(view.kpis.todayOut) },
              ]}
            />

            <KpiTablePanel
              title="Satın Alma Özeti"
              icon={ShoppingCart}
              items={[
                { icon: ShoppingCart, tint: "cyan", label: "Açık Sipariş", value: formatNumber(view.kpis.openPurchaseOrders) },
                { icon: Clock, tint: "yellow", label: "Bekleyen Teslimat", value: formatNumber(view.kpis.pendingDeliveries) },
                { icon: Wallet, tint: "teal", label: "Toplam Tutar", value: formatCurrency(view.kpis.purchaseTotalValue, currency, rates?.[currency] || 1, showKurus) },
                { icon: XCircle, tint: "red", label: "İptal", value: formatNumber(view.kpis.cancelledOrders) },
              ]}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <KpiTablePanel
              title="Envanter & Tedarik Özeti"
              icon={Database}
              items={[
                { icon: Database, tint: "sky", label: "Eldeki Miktar", value: `${formatNumber(view.kpis.onHandUnits)} Adet` },
                { icon: Truck, tint: "amber", label: "Yol / Sevkiyat", value: `${formatNumber(view.kpis.incomingUnits)} Adet` },
                { icon: Building2, tint: "pink", label: "Kayıtlı Tedarikçiler", value: formatNumber(view.kpis.totalSuppliers) },
                { icon: Users, tint: "fuchsia", label: "Sistem Kullanıcıları", value: formatNumber(view.kpis.totalUsers) },
              ]}
            />

            <KpiTablePanel
              title="Katalog & Stok Sağlığı"
              icon={Layers}
              items={[
                { icon: AlertTriangle, tint: "red", label: "Kritik Stok Uyarısı", value: formatNumber(view.kpis.criticalStockCount) },
                { icon: Tag, tint: "indigo", label: "Toplam Ürün Çeşidi", value: `${formatNumber(view.kpis.productVariantCount)} Çeşit` },
                { icon: Layers, tint: "violet", label: "Kategori Sayısı", value: formatNumber(view.kpis.categoryCount) },
              ]}
            />
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

      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dışa Aktarma Seçenekleri</DialogTitle>
            <DialogDescription>
              Rapora dahil edilecek bölümleri seçin, ardından dosya biçimini belirleyin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-4">
            {/* Step 1 — content selection */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-micro uppercase text-muted-foreground">Rapor Bölümleri</p>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {selectedSections.includes("all") ? ALL_SPECIFIC_IDS.length : selectedSections.length} /{" "}
                  {ALL_SPECIFIC_IDS.length} seçili
                </span>
              </div>
              <div className="grid max-h-52 grid-cols-1 gap-2 overflow-y-auto pr-1 custom-scrollbar sm:grid-cols-2">
                {REPORT_SECTIONS.map((sec) => {
                  const isSelected =
                    sec.id === "all"
                      ? selectedSections.includes("all") || selectedSections.length === ALL_SPECIFIC_IDS.length
                      : selectedSections.includes("all") || selectedSections.includes(sec.id);

                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => toggleSection(sec.id)}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 text-left transition-colors",
                        isSelected
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-card hover:bg-muted/50",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[3px] border",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/40",
                        )}
                      >
                        {isSelected && <Check className="size-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-foreground">{sec.label}</span>
                        <span className="mt-0.5 line-clamp-1 block text-micro text-muted-foreground">{sec.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {!hasSelection && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-status-warning-foreground">
                  <AlertTriangle className="size-3.5" />
                  İndirmek için en az bir bölüm seçin.
                </p>
              )}
            </div>

            {/* Step 2 — file format */}
            <div>
              <p className="mb-2 text-micro uppercase text-muted-foreground">Dosya Biçimi</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={exporting || !hasSelection}
                  onClick={exportExcel}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-40"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    {excelGuard.pending ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">Excel</span>
                    <span className="block text-xs text-muted-foreground">.xlsx çalışma kitabı</span>
                  </span>
                </button>

                <button
                  type="button"
                  disabled={exporting || !hasSelection}
                  onClick={exportPdf}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-40"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    {pdfGuard.pending ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">PDF</span>
                    <span className="block text-xs text-muted-foreground">Yazdırmaya hazır belge</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
