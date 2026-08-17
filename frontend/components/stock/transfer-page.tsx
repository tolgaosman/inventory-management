"use client";

import { useState } from "react";
import { ArrowLeftRight, Package, CalendarDays } from "lucide-react";
import { StatGrid } from "@/components/common/stat-card";
import { Section, SectionStack } from "@/components/common/section";
import { PageHeader } from "@/components/common/page-header";
import { Can } from "@/components/common/can";
import { ForbiddenState } from "@/components/common/forbidden-state";
import { TransferForm } from "@/components/stock/transfer-form";
import { RecentTransfersList } from "@/components/stock/recent-transfers-list";
import { TransferHistoryTable } from "@/components/stock/transfer-history-table";
import { useAsync } from "@/lib/hooks/use-async";
import { listWarehouses, listUsers } from "@/lib/api/catalog";
import { listProducts } from "@/lib/api/products";
import { listMovements } from "@/lib/api/movements";
import { isToday } from "@/lib/mock/dashboard";
import { formatNumber } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/constants";

export function TransferPage() {
  const [page, setPage] = useState(1);

  const { data, staleData, status, refetch } = useAsync(
    () =>
      Promise.all([
        listWarehouses(),
        listUsers(),
        listProducts({ pageSize: 2000 }),
        listMovements({ type: "transfer", pageSize: 200 }),
        listMovements({ type: "transfer", page, pageSize: PAGE_SIZE }),
      ]),
    [page],
  );
  const view = data ?? staleData;
  const [warehouses, users, productResult, statsResult, tableResult] = view ?? [];

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
    <Can permission="stock.transfer" fallback={<Forbidden />}>
      <div className="space-y-6">
        <PageHeader
          title="Depolar Arası Transfer"
          description="Stoğu depolar arasında taşıyın, sistem her iki depo bakiyesini otomatik günceller."
        />

        <SectionStack className={status === "loading" ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <Section index={0}>
            <StatGrid
              className="grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1"
              items={[
                { icon: ArrowLeftRight, tint: "blue", label: "Bugünkü Transfer", value: `${formatNumber(todayUnits)} adet` },
                { icon: CalendarDays, tint: "teal", label: "Bu Ay Transfer", value: `${formatNumber(monthUnits)} adet` },
                { icon: Package, tint: "neutral", label: "Bugünkü Kayıt Sayısı", value: formatNumber(todayCount) },
              ]}
            />
          </Section>

          <Section index={1} className="grid items-stretch gap-4 lg:grid-cols-[5fr_7fr] xl:grid-cols-[4fr_8fr]">
            <TransferForm warehouses={warehouses ?? []} onDone={handleDone} />
            <div className="relative h-[400px] lg:h-auto">
              <div className="h-full w-full lg:absolute lg:inset-0">
                <RecentTransfersList
                  className="h-full"
                  movements={statsResult?.rows.slice(0, 10) ?? []}
                  products={productResult?.rows ?? []}
                  warehouses={warehouses ?? []}
                />
              </div>
            </div>
          </Section>

          <Section index={2}>
            <TransferHistoryTable
              movements={tableResult?.rows ?? []}
              total={tableResult?.total ?? 0}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              loading={status === "loading" && !view}
              products={productResult?.rows ?? []}
              warehouses={warehouses ?? []}
              users={users ?? []}
            />
          </Section>
        </SectionStack>
      </div>
    </Can>
  );
}

function Forbidden() {
  return (
    <div className="space-y-6">
      <PageHeader title="Depolar Arası Transfer" />
      <ForbiddenState message="Depolar arası transfer yapmak için yetkiniz yok." />
    </div>
  );
}
