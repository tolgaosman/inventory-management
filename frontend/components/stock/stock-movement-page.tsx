"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Package, CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { CriticalStockList } from "@/components/dashboard/critical-stock-list";
import { PageHeader } from "@/components/common/page-header";
import { Can } from "@/components/common/can";
import { ForbiddenState } from "@/components/common/forbidden-state";
import { StockEntryForm } from "@/components/stock/stock-entry-form";
import { RecentMovementsCard } from "@/components/stock/recent-movements-card";
import { RecentSideMovementsList } from "@/components/stock/recent-side-movements-list";
import { useAsync } from "@/lib/hooks/use-async";
import { listWarehouses, listSuppliers, listUsers } from "@/lib/api/catalog";
import { listProducts } from "@/lib/api/products";
import { listMovements } from "@/lib/api/movements";
import { isToday, getCriticalProducts } from "@/lib/mock/dashboard";
import { formatNumber } from "@/lib/format";
import { MOVEMENT_TYPE_LABELS, PAGE_SIZE } from "@/lib/constants";

const MODE_META = {
  giris: {
    description: "Depoya yeni gelen ürünleri kaydedin, sistem stok miktarını otomatik artırır.",
    permission: "stock.in" as const,
    tint: "positive" as const,
    icon: ArrowDownToLine,
  },
  cikis: {
    description: "Satış, fire veya sayım düzeltmesiyle depodan çıkan ürünleri kaydedin.",
    permission: "stock.out" as const,
    tint: "critical" as const,
    icon: ArrowUpFromLine,
  },
};

export function StockMovementPage({ mode }: { mode: "giris" | "cikis" }) {
  const meta = MODE_META[mode];
  const [page, setPage] = useState(1);
  const formRef = useRef<HTMLDivElement>(null);
  const [formHeight, setFormHeight] = useState<number>();

  useEffect(() => {
    const el = formRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setFormHeight(entries[0].contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { data, staleData, status, refetch } = useAsync(
    () =>
      Promise.all([
        listWarehouses(),
        listSuppliers({ pageSize: 1000 }),
        listUsers(),
        listProducts({ pageSize: 2000 }),
        listMovements({ type: mode, pageSize: 200 }),
        listMovements({ type: mode, page, pageSize: PAGE_SIZE }),
      ]),
    [mode, page],
  );
  const view = data ?? staleData;
  const [warehouses, supplierResult, users, productResult, statsResult, tableResult] = view ?? [];

  const todayCount = statsResult?.rows.filter((m) => isToday(m.createdAt)).length ?? 0;
  const todayUnits =
    statsResult?.rows.filter((m) => isToday(m.createdAt)).reduce((sum, m) => sum + m.quantity, 0) ?? 0;
  const monthUnits =
    statsResult?.rows
      .filter((m) => {
        const d = new Date(m.createdAt);
        const now = new Date();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, m) => sum + m.quantity, 0) ?? 0;

  function handleDone() {
    setPage(1);
    refetch();
  }

  return (
    <Can permission={meta.permission} fallback={<Forbidden mode={mode} />}>
      <div className="space-y-6">
        <PageHeader title={MOVEMENT_TYPE_LABELS[mode]} description={meta.description} />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Card className="py-5 gap-2">
            <CardContent className="px-5">
              <KpiTile
                icon={meta.icon}
                tint={meta.tint}
                label="Bugünkü Toplam"
                value={`${formatNumber(todayUnits)} adet`}
              />
            </CardContent>
          </Card>
          <Card className="py-5 gap-2">
            <CardContent className="px-5">
              <KpiTile icon={CalendarDays} tint="blue" label="Bu Ay Toplam" value={`${formatNumber(monthUnits)} adet`} />
            </CardContent>
          </Card>
          <Card className="py-5 gap-2 col-span-2 lg:col-span-1">
            <CardContent className="px-5">
              <KpiTile icon={Package} tint="neutral" label="Bugünkü Kayıt Sayısı" value={formatNumber(todayCount)} />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 items-start">
          <div ref={formRef}>
            <StockEntryForm
              mode={mode}
              warehouses={warehouses ?? []}
              suppliers={supplierResult?.rows ?? []}
              onDone={handleDone}
            />
          </div>
          <div style={formHeight ? { height: formHeight } : undefined}>
            {mode === "giris" ? (
              <CriticalStockList items={getCriticalProducts()} />
            ) : (
              <RecentSideMovementsList
                movements={statsResult?.rows.slice(0, 10) ?? []}
                products={productResult?.rows ?? []}
              />
            )}
          </div>
        </div>

        <RecentMovementsCard
          mode={mode}
          movements={tableResult?.rows ?? []}
          total={tableResult?.total ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          loading={status === "loading" && !view}
          products={productResult?.rows ?? []}
          warehouses={warehouses ?? []}
          suppliers={supplierResult?.rows ?? []}
          users={users ?? []}
        />
      </div>
    </Can>
  );
}

function Forbidden({ mode }: { mode: "giris" | "cikis" }) {
  return (
    <div className="space-y-6">
      <PageHeader title={MOVEMENT_TYPE_LABELS[mode]} />
      <ForbiddenState message={`${MOVEMENT_TYPE_LABELS[mode]} işlemi yapmak için yetkiniz yok.`} />
    </div>
  );
}
