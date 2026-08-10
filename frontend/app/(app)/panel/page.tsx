"use client";

import { useState } from "react";
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
import { getDashboardData, type DateRangePreset } from "@/lib/api/dashboard";
import { useAsync } from "@/lib/hooks/use-async";
import { formatCurrency, formatNumber } from "@/lib/format";

const RANGE_LABELS: Record<DateRangePreset, string> = {
  "bu-ay": "Bu ay",
  "son-3-ay": "Son 3 ay",
  "son-6-ay": "Son 6 ay",
  "bu-yil": "Bu yıl",
};

export default function PanelPage() {
  const [range, setRange] = useState<DateRangePreset>("son-6-ay");
  const { status, data, staleData, error, refetch } = useAsync(() => getDashboardData(range), [range]);
  const view = data ?? staleData;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel"
        description="Şirket genelinde stok, satın alma ve depo özetini görün."
        actions={
          <>
            <Select value={range} onValueChange={(v) => setRange(v as DateRangePreset)}>
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
            <Button variant="outline" size="sm">
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
              <KpiTile icon={Warehouse} tint="violet" label="Toplam Depo" value={formatNumber(view.kpis.totalWarehouses)} />
              <KpiTile icon={ArrowDownToLine} tint="green" label="Bugünkü Giriş" value={formatNumber(view.kpis.todayIn)} />
              <KpiTile icon={ArrowUpFromLine} tint="orange" label="Bugünkü Çıkış" value={formatNumber(view.kpis.todayOut)} />
            </KpiPanel>

            <KpiPanel title="Satın Alma Özeti" icon={ShoppingCart}>
              <KpiTile icon={ShoppingCart} tint="blue" label="Açık Sipariş" value={formatNumber(view.kpis.openPurchaseOrders)} />
              <KpiTile icon={Clock} tint="yellow" label="Bekleyen Teslimat" value={formatNumber(view.kpis.pendingDeliveries)} />
              <KpiTile icon={Wallet} tint="green" label="Toplam Tutar" value={formatCurrency(view.kpis.purchaseTotalValue)} />
              <KpiTile icon={XCircle} tint="red" label="İptal" value={formatNumber(view.kpis.cancelledOrders)} />
            </KpiPanel>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="shadow-soft border-border/70 gap-4 py-5">
              <CardHeader className="px-5">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Layers className="size-4 text-muted-foreground" />
                  Envanter Özeti
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 px-5">
                <KpiTile icon={Boxes} tint="blue" label="Eldeki Miktar" value={formatNumber(view.kpis.onHandUnits)} />
                <KpiTile icon={Truck} tint="orange" label="Yolda" value={formatNumber(view.kpis.incomingUnits)} />
              </CardContent>
            </Card>

            <Card className="shadow-soft border-border/70 gap-4 py-5">
              <CardHeader className="px-5">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Users className="size-4 text-muted-foreground" />
                  Kullanıcı &amp; Tedarikçi
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 px-5">
                <KpiTile icon={Users} tint="violet" label="Toplam Kullanıcı" value={formatNumber(view.kpis.totalUsers)} />
                <KpiTile icon={Truck} tint="green" label="Toplam Tedarikçi" value={formatNumber(view.kpis.totalSuppliers)} />
              </CardContent>
            </Card>

            <Card className="shadow-soft border-border/70 gap-4 py-5">
              <CardHeader className="px-5">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="size-4 text-muted-foreground" />
                  Stok Durumu
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 px-5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Kritik Stok</span>
                  <span className="font-medium text-status-critical">{formatNumber(view.kpis.criticalStockCount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Kategori</span>
                  <span className="font-medium">{formatNumber(view.kpis.categoryCount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ürün Çeşidi</span>
                  <span className="font-medium">{formatNumber(view.kpis.productVariantCount)}</span>
                </div>
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

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
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
