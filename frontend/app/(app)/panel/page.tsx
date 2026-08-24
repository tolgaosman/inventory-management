"use client";

import { useRouter } from "next/navigation";
import { NAV_SECTIONS } from "@/components/layout/nav-config";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Package,
  Warehouse,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
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
  LayoutDashboard,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/error-state";
import { Can } from "@/components/common/can";
import { StatePanel } from "@/components/common/state-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Section } from "@/components/common/section";
import { StatGrid } from "@/components/common/stat-card";
import { KpiMetaBar } from "@/components/common/kpi-meta-bar";
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

// Satır 2'de hangi widget'lar görünürse görünsün 12 kolon boşluksuz dolsun diye
// kombinasyona özel span'ler. Anahtar: P = satın alma özeti, C = stok dağılımı,
// M = son stok hareketleri, F = stok sağlığı. "PCMF" girdisi tam yetkili
// yerleşimin birebir aynısıdır — değiştirilmemeli.
const ROW2_SPANS: Record<string, { P?: string; C?: string; M?: string; F?: string }> = {
  PCMF: { P: "lg:col-span-4", C: "lg:col-span-4", M: "lg:col-span-4 lg:row-span-2", F: "lg:col-span-8" },
  PCM: { P: "lg:col-span-4", C: "lg:col-span-4", M: "lg:col-span-4" },
  PCF: { P: "lg:col-span-6", C: "lg:col-span-6", F: "lg:col-span-12" },
  PMF: { P: "lg:col-span-6", M: "lg:col-span-6", F: "lg:col-span-12" },
  CMF: { C: "lg:col-span-6", M: "lg:col-span-6", F: "lg:col-span-12" },
  PC: { P: "lg:col-span-6", C: "lg:col-span-6" },
  PM: { P: "lg:col-span-6", M: "lg:col-span-6" },
  PF: { P: "lg:col-span-4", F: "lg:col-span-8" },
  CM: { C: "lg:col-span-6", M: "lg:col-span-6" },
  CF: { C: "lg:col-span-4", F: "lg:col-span-8" },
  MF: { M: "lg:col-span-4", F: "lg:col-span-8" },
  P: { P: "lg:col-span-12" },
  C: { C: "lg:col-span-12" },
  M: { M: "lg:col-span-12" },
  F: { F: "lg:col-span-12" },
};

export default function PanelPage() {
  return (
    <Can permission="dashboard.view" fallback={<RedirectFallback />}>
      <PanelContent />
    </Can>
  );
}

function RedirectFallback() {
  const router = useRouter();
  const { can } = useAuth();
  
  useEffect(() => {
    // Bulunan ilk erişilebilir sayfaya yönlendir (panel hariç)
    const accessibleItem = NAV_SECTIONS.flatMap((s) => s.items)
      .flatMap((item) => (item.children ? [item, ...item.children] : [item]))
      .find((item) => {
        if (item.href === "/panel") return false;
        if (!item.permission) return true;
        if (Array.isArray(item.permission)) return item.permission.some(can);
        return can(item.permission);
      });

    if (accessibleItem) {
      router.replace(accessibleItem.href);
    } else {
      // Eğer hiçbir yetkisi yoksa veya hala yönlendirilemediyse
      router.replace("/giris");
    }
  }, [can, router]);

  return (
    <div className="flex h-[50vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}


function PanelContent() {
  const { company, showKurus } = useSettings();
  const { range, warehouseId } = useDashboardFilter();

  const { status, data, staleData, error, refetch } = useAsync(
    () => getDashboardData(range, warehouseId),
    [range, warehouseId],
  );
  const view = data ?? staleData;

  const { name, role, can } = useAuth();

  // Each dashboard widget is individually grantable, so a role can be given the
  // page without every section on it.
  const showKpis = can("dashboard.kpis");
  const showMeta = can("dashboard.meta");
  const showPurchase = can("dashboard.purchase_summary");
  const showCategory = can("dashboard.category_chart");
  const showMovements = can("dashboard.recent_movements");
  const showFlow = can("dashboard.stock_flow");
  const showWarehouse = can("dashboard.warehouse_stock");
  const showTopMovers = can("dashboard.top_movers");
  const showCritical = can("dashboard.critical_stock");
  const anyVisible =
    showKpis || showMeta || showPurchase || showCategory || showMovements ||
    showFlow || showWarehouse || showTopMovers || showCritical;
  const { currency, rates } = useCurrency();

  // Görünür bölümleri bitişik sırayla numaralandır (stagger animasyonu için) —
  // gizli bölümler numaralamada delik bırakmasın.
  const sectionFlags = [
    showKpis,
    showMeta,
    showPurchase || showCategory || showMovements || showFlow,
    showWarehouse || showTopMovers,
    showCritical,
  ];
  const sectionIndex = (i: number) => sectionFlags.slice(0, i).filter(Boolean).length;

  const row2Key =
    `${showPurchase ? "P" : ""}${showCategory ? "C" : ""}${showMovements ? "M" : ""}${showFlow ? "F" : ""}`;
  const row2 = ROW2_SPANS[row2Key] ?? {};
  const bothRow3 = showWarehouse && showTopMovers;
  const row3W = bothRow3 ? "lg:col-span-7" : "lg:col-span-12";
  const row3T = bothRow3 ? "lg:col-span-5" : "lg:col-span-12";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gösterge Paneli"
        description="Şirket genelinde stok, satın alma ve depo özetini görün."
      />

      {status === "error" && !view ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : !view ? (
        <DashboardSkeleton
          showKpis={showKpis}
          showMeta={showMeta}
          showPurchase={showPurchase}
          showCategory={showCategory}
          showMovements={showMovements}
          showFlow={showFlow}
          showWarehouse={showWarehouse}
          showTopMovers={showTopMovers}
          showCritical={showCritical}
          row2={row2}
          row2Key={row2Key}
          row3W={row3W}
          row3T={row3T}
        />
      ) : (
        <div className={cn("space-y-4", status === "loading" ? "opacity-60 transition-opacity" : "transition-opacity")}>
          {showKpis && (
          <Section index={sectionIndex(0)}>
          <StatGrid
            items={[
              { icon: Package, tint: "blue", label: "Toplam Ürün", value: formatNumber(view.kpis.totalProducts) },
              { icon: Warehouse, tint: "teal", label: "Toplam Depo", value: formatNumber(view.kpis.totalWarehouses) },
              {
                icon: AlertTriangle,
                tint: "red",
                label: "Stok İhtiyacı",
                value: formatNumber(view.kpis.criticalStockCount),
                emphasize: view.kpis.criticalStockCount > 0,
              },
              { icon: ArrowDownToLine, tint: "green", label: "Bugünkü Giriş", value: formatNumber(view.kpis.todayIn) },
              { icon: ArrowUpFromLine, tint: "amber", label: "Bugünkü Çıkış", value: formatNumber(view.kpis.todayOut) },
            ]}
          />
          </Section>
          )}

          {showMeta && (
          <Section index={sectionIndex(1)}>
          <KpiMetaBar
            items={[
              { icon: Database, tint: "blue", label: "Eldeki Miktar", value: `${formatNumber(view.kpis.onHandUnits)} adet` },
              { icon: Truck, tint: "amber", label: "Yol / Sevkiyat", value: `${formatNumber(view.kpis.incomingUnits)} adet` },
              { icon: Building2, tint: "plum", label: "Kayıtlı Tedarikçi", value: formatNumber(view.kpis.totalSuppliers) },
              { icon: Users, tint: "teal", label: "Sistem Kullanıcısı", value: formatNumber(view.kpis.totalUsers) },
              { icon: Layers, tint: "plum", label: "Kategori Sayısı", value: formatNumber(view.kpis.categoryCount) },
            ]}
          />
          </Section>
          )}

          {(showPurchase || showCategory || showMovements || showFlow) && (
          <Section index={sectionIndex(2)} className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-stretch">
            {showPurchase && (
            <div className={row2.P}>
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
            )}
            {showCategory && (
            <div className={cn(row2.C, row2Key !== "PCMF" && "min-h-[210px]")}>
              <CategoryRadialChart shares={view.categoryShares} />
            </div>
            )}
            {showMovements && (
            <div className={row2.M}>
              <RecentMovementsTable items={view.recentMovements} />
            </div>
            )}
            {showFlow && (
            <div className={row2.F}>
              <StockFlowChart data={view.monthlyFlow} />
            </div>
            )}
          </Section>
          )}

          {(showWarehouse || showTopMovers) && (
          <Section index={sectionIndex(3)} className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-stretch">
            {showWarehouse && (
            <div className={row3W}>
              <WarehouseStockBars data={view.warehouseTotals} />
            </div>
            )}
            {showTopMovers && (
            <div className={row3T}>
              <TopMoversList items={view.topMovers} />
            </div>
            )}
          </Section>
          )}

          {showCritical && (
          <Section index={sectionIndex(4)}>
            <CriticalStockList items={view.criticalProducts} />
          </Section>
          )}

          {!anyVisible && (
            <StatePanel
              icon={LayoutDashboard}
              tint="blue"
              title="Panel boş"
              description="Görüntüleyebileceğiniz bir panel bileşeni bulunmuyor. Rolünüze panel bölümü izni verilmesi için yöneticinize başvurun."
            />
          )}
        </div>
      )}

    </div>
  );
}

function DashboardSkeleton({
  showKpis,
  showMeta,
  showPurchase,
  showCategory,
  showMovements,
  showFlow,
  showWarehouse,
  showTopMovers,
  showCritical,
  row2,
  row2Key,
  row3W,
  row3T,
}: {
  showKpis: boolean;
  showMeta: boolean;
  showPurchase: boolean;
  showCategory: boolean;
  showMovements: boolean;
  showFlow: boolean;
  showWarehouse: boolean;
  showTopMovers: boolean;
  showCritical: boolean;
  row2: { P?: string; C?: string; M?: string; F?: string };
  row2Key: string;
  row3W: string;
  row3T: string;
}) {
  const showRow2 = showPurchase || showCategory || showMovements || showFlow;
  const showRow3 = showWarehouse || showTopMovers;
  return (
    <div className="space-y-4">
      {showKpis && (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] rounded-xl" />
        ))}
      </div>
      )}
      {showMeta && <Skeleton className="h-[52px] rounded-xl" />}
      {showRow2 && (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {showPurchase && <Skeleton className={cn("h-[210px] rounded-xl", row2.P)} />}
        {showCategory && <Skeleton className={cn("h-[210px] rounded-xl", row2.C)} />}
        {showMovements && (
          <Skeleton className={cn(row2Key === "PCMF" ? "h-[432px]" : "h-[210px]", "rounded-xl", row2.M)} />
        )}
        {showFlow && <Skeleton className={cn("h-[210px] rounded-xl", row2.F)} />}
      </div>
      )}
      {showRow3 && (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {showWarehouse && <Skeleton className={cn("h-[360px] rounded-xl", row3W)} />}
        {showTopMovers && <Skeleton className={cn("h-[360px] rounded-xl", row3T)} />}
      </div>
      )}
      {showCritical && <Skeleton className="h-[320px] rounded-xl" />}
    </div>
  );
}
