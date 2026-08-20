"use client";

import { ArrowDownToLine, ArrowUpFromLine, Package, ArrowLeftRight, History, PackageCheck } from "lucide-react";
import { StatGrid } from "@/components/common/stat-card";
import { Section, SectionStack } from "@/components/common/section";
import { PageHeader } from "@/components/common/page-header";
import { PanelCard } from "@/components/common/panel-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Can } from "@/components/common/can";
import { ForbiddenState } from "@/components/common/forbidden-state";
import { StockEntryForm } from "@/components/stock/stock-entry-form";
import { RecentSideMovementsList } from "@/components/stock/recent-side-movements-list";
import { PendingPurchasesList } from "@/components/stock/pending-purchases-list";
import { TransferForm } from "@/components/stock/transfer-form";
import { RecentTransfersList } from "@/components/stock/recent-transfers-list";
import { useAsync } from "@/lib/hooks/use-async";
import { listWarehouses, listSuppliers } from "@/lib/api/catalog";
import { listProducts } from "@/lib/api/products";
import { listMovements } from "@/lib/api/movements";
import { isToday } from "@/lib/format";
import { formatNumber } from "@/lib/format";

export function CombinedMovementPage() {
  const { data, staleData, status, refetch } = useAsync(
    () =>
      Promise.all([
        listWarehouses(),
        listSuppliers({ pageSize: 1000 }),
        listProducts({ pageSize: 2000 }),
        listMovements({ type: "giris", pageSize: 50 }),
        listMovements({ type: "cikis", pageSize: 50 }),
        listMovements({ type: "transfer", pageSize: 50 }),
      ]),
    [],
  );
  const view = data ?? staleData;
  const [warehouses, supplierResult, productResult, girisStats, cikisStats, transferStats] = view ?? [];

  const girisTodayUnits =
    girisStats?.rows.filter((m) => isToday(m.createdAt)).reduce((sum, m) => sum + m.quantity, 0) ?? 0;
  const cikisTodayUnits =
    cikisStats?.rows.filter((m) => isToday(m.createdAt)).reduce((sum, m) => sum + m.quantity, 0) ?? 0;
  const transferTodayUnits =
    transferStats?.rows.filter((m) => isToday(m.createdAt)).reduce((sum, m) => sum + m.quantity, 0) ?? 0;
  const totalTodayCount =
    (girisStats?.rows.filter((m) => isToday(m.createdAt)).length ?? 0) +
    (cikisStats?.rows.filter((m) => isToday(m.createdAt)).length ?? 0) +
    (transferStats?.rows.filter((m) => isToday(m.createdAt)).length ?? 0);

  function handleDone() {
    refetch();
  }

  return (
    <Can permission={["stock.in", "stock.out", "stock.transfer"]} fallback={<Forbidden />}>
      <div className="space-y-6">
        <PageHeader title="Giriş / Çıkış / Transfer" description="Deponuza yeni giren, çıkan ve transfer edilen stok hareketlerini tek ekrandan yönetin." />

        <SectionStack className={status === "loading" ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <Section index={0}>
            <StatGrid
              className="grid-cols-2 gap-4 lg:grid-cols-4 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1"
              items={[
                {
                  icon: ArrowDownToLine,
                  tint: "positive",
                  label: "Bugünkü Toplam Giriş",
                  value: `${formatNumber(girisTodayUnits)} adet`,
                },
                {
                  icon: ArrowUpFromLine,
                  tint: "critical",
                  label: "Bugünkü Toplam Çıkış",
                  value: `${formatNumber(cikisTodayUnits)} adet`,
                },
                {
                  icon: ArrowLeftRight,
                  tint: "blue",
                  label: "Bugünkü Transfer",
                  value: `${formatNumber(transferTodayUnits)} adet`,
                },
                {
                  icon: Package,
                  tint: "neutral",
                  label: "Bugünkü İşlem Sayısı",
                  value: formatNumber(totalTodayCount),
                },
              ]}
            />
          </Section>

          <Section index={1} className="grid items-stretch gap-4 lg:grid-cols-[5fr_7fr] xl:grid-cols-[4fr_8fr]">
            <Can permission="stock.in">
              <StockEntryForm
                mode="giris"
                warehouses={warehouses ?? []}
                suppliers={supplierResult?.rows ?? []}
                onDone={handleDone}
              />
              <div className="lg:relative">
                <div className="lg:absolute lg:inset-0">
                  <PanelCard className="h-full" bodyClassName="flex min-h-0 flex-1 flex-col p-0">
                    <Tabs defaultValue="recent" className="flex h-full min-h-0 flex-1 flex-col gap-0">
                      <div className="border-b border-border px-2 pt-2">
                        <TabsList variant="line" className="w-full justify-start">
                          <TabsTrigger value="recent">
                            <History className="size-4" />
                            Son Stok Girişleri
                          </TabsTrigger>
                          <TabsTrigger value="pending">
                            <PackageCheck className="size-4" />
                            Bekleyen Satın Alımlar
                          </TabsTrigger>
                        </TabsList>
                      </div>
                      <TabsContent value="recent" className="flex min-h-0 flex-1 flex-col px-4 lg:px-5">
                        <RecentSideMovementsList
                          mode="giris"
                          movements={girisStats?.rows.slice(0, 10) ?? []}
                          products={productResult?.rows ?? []}
                          noCard
                        />
                      </TabsContent>
                      <TabsContent value="pending" className="flex min-h-0 flex-1 flex-col px-4 lg:px-5">
                        <PendingPurchasesList noCard />
                      </TabsContent>
                    </Tabs>
                  </PanelCard>
                </div>
              </div>
            </Can>

            <Can permission="stock.out">
              <StockEntryForm
                mode="cikis"
                warehouses={warehouses ?? []}
                suppliers={supplierResult?.rows ?? []}
                onDone={handleDone}
              />
              <div className="lg:relative">
                <div className="lg:absolute lg:inset-0">
                  <RecentSideMovementsList
                    className="h-full"
                    mode="cikis"
                    movements={cikisStats?.rows.slice(0, 10) ?? []}
                    products={productResult?.rows ?? []}
                  />
                </div>
              </div>
            </Can>

            <Can permission="stock.transfer">
              <TransferForm
                warehouses={warehouses ?? []}
                onDone={handleDone}
              />
              <div className="lg:relative">
                <div className="lg:absolute lg:inset-0">
                  <RecentTransfersList
                    className="h-full"
                    movements={transferStats?.rows.slice(0, 10) ?? []}
                    products={productResult?.rows ?? []}
                    warehouses={warehouses ?? []}
                  />
                </div>
              </div>
            </Can>
          </Section>
        </SectionStack>
      </div>
    </Can>
  );
}

function Forbidden() {
  return (
    <div className="space-y-6">
      <PageHeader title="Giriş / Çıkış / Transfer" />
      <ForbiddenState message="Stok işlemi yapmak için yetkiniz yok." />
    </div>
  );
}
