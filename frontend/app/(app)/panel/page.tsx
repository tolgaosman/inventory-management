"use client";

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
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/error-state";
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

export default function PanelPage() {
  const { company, showKurus } = useSettings();
  const { range, warehouseId } = useDashboardFilter();

  const { status, data, staleData, error, refetch } = useAsync(
    () => getDashboardData(range, warehouseId),
    [range, warehouseId],
  );
  const view = data ?? staleData;

  const { name, role } = useAuth();
  const { currency, rates } = useCurrency();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gösterge Paneli"
        description="Şirket genelinde stok, satın alma ve depo özetini görün."
      />

      {status === "error" && !view ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : !view ? (
        <DashboardSkeleton />
      ) : (
        <div className={cn("space-y-4", status === "loading" ? "opacity-60 transition-opacity" : "transition-opacity")}>
          <Section index={0}>
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

          <Section index={1}>
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
            <CriticalStockList items={view.criticalProducts} />
          </Section>
        </div>
      )}

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
