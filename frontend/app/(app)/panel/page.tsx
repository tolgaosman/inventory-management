"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Package,
  Warehouse,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Check,
  Truck,
  Users,
  Building2,
  Tag,
  Layers,
  Database,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { KpiMetaBar } from "@/components/dashboard/kpi-meta-bar";
import { PurchaseHeroCard } from "@/components/dashboard/purchase-hero-card";
import { CategoryRadialChart } from "@/components/dashboard/category-radial-chart";
import { WarehouseStockBars } from "@/components/dashboard/warehouse-stock-bars";
import { CriticalStockList } from "@/components/dashboard/critical-stock-list";
import { RecentMovementsTable } from "@/components/dashboard/recent-movements-table";
import { TopMoversList } from "@/components/dashboard/top-movers-list";
import { StockFlowChart } from "@/components/dashboard/stock-flow-chart";
import { useAsync } from "@/lib/hooks/use-async";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import { useAuth } from "@/lib/auth";
import { useDashboardFilter } from "@/lib/dashboard-filter-context";
import { ROLE_LABELS, REPORT_SECTIONS, ALL_SPECIFIC_IDS } from "@/lib/constants";
import { getDashboardData } from "@/lib/api/dashboard";
import { buildReportData } from "@/lib/export/report-data";
import { downloadBlob, reportFilename, slugify } from "@/lib/export/download";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useCurrency } from "@/lib/currency-context";
import { useSettings } from "@/lib/settings-context";

/**
 * Entrance stagger for a dashboard section.
 *
 * CSS animations fire on mount only, and this subtree mounts exactly once:
 * `useAsync` keeps `staleData` during a refetch, so a warehouse/date filter
 * change re-renders in place instead of remounting. The intro therefore plays
 * on first load and never replays on filter changes, which is the difference
 * between one authored moment and the same entrance firing at every keystroke.
 * `animationFillMode: backwards` holds the pre-animation state during the
 * delay so nothing flashes in before its turn.
 */
function Section({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("animate-in fade-in slide-in-from-bottom-2 duration-[260ms] ease-out-strong", className)}
      style={{ animationDelay: `${index * 40}ms`, animationFillMode: "backwards" }}
    >
      {children}
    </div>
  );
}

export default function PanelPage() {
  const { company, showKurus } = useSettings();
  const { range, warehouseId } = useDashboardFilter();
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedSections, setSelectedSections] = useState<string[]>(["all"]);

  useEffect(() => {
    const handleOpen = () => setShowExportModal(true);
    window.addEventListener("open-export-modal", handleOpen);
    return () => window.removeEventListener("open-export-modal", handleOpen);
  }, []);

  const { status, data, staleData, error, refetch } = useAsync(
    () => getDashboardData(range, warehouseId),
    [range, warehouseId],
  );
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
      />

      {status === "error" && !view ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : !view ? (
        <DashboardSkeleton />
      ) : (
        <div className={cn("space-y-4", status === "loading" ? "opacity-60 transition-opacity" : "transition-opacity")}>
          <Section index={0}>
          <KpiStrip
            items={[
              { icon: Package, tint: "blue", label: "Toplam Ürün", value: formatNumber(view.kpis.totalProducts) },
              { icon: Warehouse, tint: "teal", label: "Toplam Depo", value: formatNumber(view.kpis.totalWarehouses) },
              {
                icon: AlertTriangle,
                tint: "red",
                label: "Kritik Stok",
                value: formatNumber(view.kpis.criticalStockCount),
                emphasize: view.kpis.criticalStockCount > 0,
              },
              { icon: ArrowDownToLine, tint: "green", label: "Bugünkü Giriş", value: formatNumber(view.kpis.todayIn) },
              { icon: ArrowUpFromLine, tint: "amber", label: "Bugünkü Çıkış", value: formatNumber(view.kpis.todayOut) },
            ]}
          />
          </Section>

          <Section index={1}>
          <KpiMetaBar
            items={[
              { icon: Database, tint: "blue", label: "Eldeki Miktar", value: `${formatNumber(view.kpis.onHandUnits)} adet` },
              { icon: Truck, tint: "amber", label: "Yol / Sevkiyat", value: `${formatNumber(view.kpis.incomingUnits)} adet` },
              { icon: Building2, tint: "plum", label: "Kayıtlı Tedarikçi", value: formatNumber(view.kpis.totalSuppliers) },
              { icon: Users, tint: "teal", label: "Sistem Kullanıcısı", value: formatNumber(view.kpis.totalUsers) },
              { icon: Layers, tint: "plum", label: "Kategori Sayısı", value: formatNumber(view.kpis.categoryCount) },
              { icon: Tag, tint: "blue", label: "Ürün Çeşidi", value: formatNumber(view.kpis.productVariantCount) },
            ]}
          />
          </Section>

          <Section index={2} className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-4">
              <PurchaseHeroCard
                data={{
                  cancelledOrders: view.kpis.cancelledOrders,
                  pendingDeliveries: view.kpis.pendingDeliveries,
                  openPurchaseOrders: view.kpis.openPurchaseOrders,
                  totalPurchaseOrders: view.kpis.totalPurchaseOrders,
                  purchaseTotalValueLabel: formatCurrency(view.kpis.purchaseTotalValue, currency, rates?.[currency] || 1, showKurus),
                }}
              />
            </div>
            <div className="lg:col-span-4">
              <CategoryRadialChart shares={view.categoryShares} />
            </div>
            <div className="lg:col-span-4 lg:row-span-2">
              <RecentMovementsTable items={view.recentMovements} />
            </div>
            <div className="lg:col-span-8">
              <StockFlowChart data={view.monthlyFlow} />
            </div>
          </Section>

          <Section index={3} className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-7">
              <WarehouseStockBars data={view.warehouseTotals} />
            </div>
            <div className="lg:col-span-5">
              <TopMoversList items={view.topMovers} />
            </div>
          </Section>

          <Section index={4}>
            <CriticalStockList items={view.criticalProducts} onExport={() => setShowExportModal(true)} />
          </Section>
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[52px] rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Skeleton className="h-[210px] rounded-xl lg:col-span-4" />
        <Skeleton className="h-[210px] rounded-xl lg:col-span-4" />
        <Skeleton className="h-[432px] rounded-xl lg:col-span-4 lg:row-span-2" />
        <Skeleton className="h-[210px] rounded-xl lg:col-span-8" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Skeleton className="h-[360px] rounded-xl lg:col-span-7" />
        <Skeleton className="h-[360px] rounded-xl lg:col-span-5" />
      </div>
      <Skeleton className="h-[320px] rounded-xl" />
    </div>
  );
}
