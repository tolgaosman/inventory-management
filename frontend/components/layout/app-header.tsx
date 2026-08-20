"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, LogOut, Settings, AlertTriangle, Warehouse, CalendarRange, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS, PURCHASE_STATUS_LABELS } from "@/lib/constants";
import { receivePercent } from "@/lib/purchase-order-actions";

import { getCriticalStockNotifications, RANGE_LABELS, type DateRangePreset } from "@/lib/api/dashboard";
import { listPurchaseOrders, getPendingReceiptOrders } from "@/lib/api/purchase-orders";
import { listWarehouses } from "@/lib/api/catalog";
import { PackageCheck } from "lucide-react";
import { useAsync } from "@/lib/hooks/use-async";
import { useDashboardFilter } from "@/lib/dashboard-filter-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSettings } from "@/lib/settings-context";
import { HeaderBreadcrumb, MobileNav } from "./header-nav";


function DashboardFilters() {
  const { range, setRange, warehouseId, setWarehouseId } = useDashboardFilter();
  const { data: warehouses } = useAsync(() => listWarehouses(), []);

  return (
    // Scrolls rather than overflows: the two selects plus the export button are
    // wider than a phone header.
    <div className="flex min-w-0 items-center gap-2 overflow-x-auto custom-scrollbar">
      <Select
        value={warehouseId ?? "all"}
        onValueChange={(v) => setWarehouseId(!v || v === "all" ? undefined : v)}
      >
        <SelectTrigger className="w-fit min-w-[200px]">
          <Warehouse className="size-3.5 text-muted-foreground shrink-0" />
          <SelectValue>
            {warehouseId ? warehouses?.find((w) => w.id === warehouseId)?.name ?? "Depo" : "Tüm Depolar"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tüm Depolar</SelectItem>
          {warehouses?.map((w) => (
            <SelectItem key={w.id} value={w.id}>
              {w.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
        <SelectTrigger className="w-fit min-w-[140px]">
          <CalendarRange className="size-3.5 text-muted-foreground shrink-0" />
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

    </div>
  );
}

export function AppHeader() {
  const { name, initials, role, status, signOut } = useAuth();
  const { notifications } = useSettings();
  const pathname = usePathname();
  const isPanel = pathname?.replace(/\/$/, "") === "/panel";

  const isDepoRole = role === "depo" || role === "depo_yonetici";

  // Both header requests fetched together — one wave instead of two. Both are
  // cached (getCriticalStockNotifications / listPurchaseOrders in lib/api-cache.ts),
  // so this also dedupes against whatever the page body itself is fetching.
  const { data: headerData } = useAsync(async () => {
    const [notif, pendingApprovalsData, pendingReceiptOrders] = await Promise.all([
      getCriticalStockNotifications(5),
      role === "satinalma_yonetici"
        ? listPurchaseOrders({ status: "pending_approval", pageSize: 5 })
        : Promise.resolve({ total: 0, rows: [], page: 1, pageSize: 5 }),
      isDepoRole ? getPendingReceiptOrders() : Promise.resolve([]),
    ]);
    return { notif, pendingApprovalsData, pendingReceiptOrders };
  }, [role]);
  const criticalCount = headerData?.notif.total ?? 0;
  const criticalItems = headerData?.notif.items ?? [];
  const pendingApprovalCount = headerData?.pendingApprovalsData.total ?? 0;
  const pendingApprovals = headerData?.pendingApprovalsData.rows ?? [];
  const pendingReceiptOrders = headerData?.pendingReceiptOrders ?? [];
  const pendingReceiptCount = pendingReceiptOrders.length;

  const totalNotifs =
    criticalCount +
    (role === "satinalma_yonetici" ? pendingApprovalCount : 0) +
    (isDepoRole ? pendingReceiptCount : 0);

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-card px-4 md:px-6">
      {/* Left slot: the dashboard owns it for its filters; every other route
          gets a breadcrumb rather than dead space. */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <MobileNav />
        {isPanel ? <DashboardFilters /> : <HeaderBreadcrumb />}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2">

      <Popover>
        <PopoverTrigger className="flex items-center gap-2 rounded-md px-3 py-1.5 transition-colors hover:bg-muted">
          <div className="relative flex items-center justify-center">
            <Bell className="size-4 text-muted-foreground" />
            {totalNotifs > 0 && (
              <span className="absolute -top-1 -right-1 size-2 rounded-full bg-destructive ring-2 ring-card" />
            )}
          </div>
          <span className="hidden text-sm font-medium sm:block">Bildirimler</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-80 overflow-hidden rounded-lg border border-border bg-popover p-0 shadow-soft">
          {role === "satinalma_yonetici" ? (
            <Tabs defaultValue="stock">
              <div className="bg-muted/40 p-2 border-b border-border">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="stock" className="text-xs">
                    Stok İhtiyaçları {criticalCount > 0 && `(${criticalCount})`}
                  </TabsTrigger>
                  <TabsTrigger value="approval" className="text-xs">
                    Onay Bekleyen {pendingApprovalCount > 0 && `(${pendingApprovalCount})`}
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="stock" className="mt-0">
                <div className="max-h-80 space-y-0.5 overflow-y-auto p-2 custom-scrollbar">
                  {criticalCount === 0 ? (
                    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                      <Bell className="mb-2 size-6 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">Stok ihtiyacı yok</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Tüm ürünler güvenli stok seviyesinde.</p>
                    </div>
                  ) : (
                    criticalItems.map((p) => (
                      <Link
                        key={p.id}
                        href={`/urunler/${p.id}`}
                        className="group flex items-start gap-2.5 rounded-md p-2.5 transition-colors hover:bg-muted"
                      >
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-critical" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                            {p.name}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Mevcut{" "}
                            <span className="font-medium tabular-nums text-status-critical">
                              {p.totalStock}
                            </span>{" "}
                            · Minimum <span className="tabular-nums">{p.minStock}</span>
                          </p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
                {criticalCount > 0 && (
                  <div className="border-t border-border bg-muted/30 p-2">
                    <Link
                      href="/urunler?stockStatus=kritik"
                      className="flex items-center justify-center rounded-md px-3 py-2 text-center text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      Tüm stok ihtiyaçlarını gör ({criticalCount})
                    </Link>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="approval" className="mt-0">
                <div className="max-h-80 space-y-0.5 overflow-y-auto p-2 custom-scrollbar">
                  {pendingApprovalCount === 0 ? (
                    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                      <ShoppingCart className="mb-2 size-6 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">Onay bekleyen sipariş yok</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Tüm talepler yanıtlanmış.</p>
                    </div>
                  ) : (
                    pendingApprovals.map((po) => (
                      <Link
                        key={po.id}
                        href={`/satin-alma/${po.id}`}
                        className="group flex items-start gap-2.5 rounded-md p-2.5 transition-colors hover:bg-muted"
                      >
                        <ShoppingCart className="mt-0.5 size-4 shrink-0 text-status-warning" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                            {po.supplierName}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {po.itemCount} ürün · Kod: <span className="font-medium">{po.code}</span>
                          </p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
                {pendingApprovalCount > 0 && (
                  <div className="border-t border-border bg-muted/30 p-2">
                    <Link
                      href="/satin-alma?status=pending_approval"
                      className="flex items-center justify-center rounded-md px-3 py-2 text-center text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      Tüm bekleyenleri gör ({pendingApprovalCount})
                    </Link>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : isDepoRole ? (
            <Tabs defaultValue="stock">
              <div className="bg-muted/40 p-2 border-b border-border">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="stock" className="text-xs">
                    Stok Uyarıları {criticalCount > 0 && `(${criticalCount})`}
                  </TabsTrigger>
                  <TabsTrigger value="purchases" className="text-xs">
                    Satın Alınanlar {pendingReceiptCount > 0 && `(${pendingReceiptCount})`}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="stock" className="mt-0">
                <div className="max-h-80 space-y-0.5 overflow-y-auto p-2 custom-scrollbar">
                  {criticalCount === 0 ? (
                    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                      <Bell className="mb-2 size-6 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">Stok ihtiyacı yok</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Tüm ürünler güvenli stok seviyesinde.</p>
                    </div>
                  ) : (
                    criticalItems.map((p) => (
                      <Link
                        key={p.id}
                        href={`/urunler/${p.id}`}
                        className="group flex items-start gap-2.5 rounded-md p-2.5 transition-colors hover:bg-muted"
                      >
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-critical" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                            {p.name}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Mevcut{" "}
                            <span className="font-medium tabular-nums text-status-critical">
                              {p.totalStock}
                            </span>{" "}
                            · Minimum <span className="tabular-nums">{p.minStock}</span>
                          </p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
                {criticalCount > 0 && (
                  <div className="border-t border-border bg-muted/30 p-2">
                    <Link
                      href="/urunler?stockStatus=kritik"
                      className="flex items-center justify-center rounded-md px-3 py-2 text-center text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      Tüm stok ihtiyaçlarını gör ({criticalCount})
                    </Link>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="purchases" className="mt-0">
                <div className="max-h-80 space-y-0.5 overflow-y-auto p-2 custom-scrollbar">
                  {pendingReceiptCount === 0 ? (
                    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                      <PackageCheck className="mb-2 size-6 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">Bekleyen teslimat yok</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Tüm satın alımlar stoğa işlendi.</p>
                    </div>
                  ) : (
                    pendingReceiptOrders.map((po) => (
                      <Link
                        key={po.id}
                        href={`/stok/islem?purchaseOrderId=${po.id}`}
                        className="group flex items-start gap-2.5 rounded-md p-2.5 transition-colors hover:bg-muted"
                      >
                        <PackageCheck className="mt-0.5 size-4 shrink-0 text-status-warning" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                            {po.supplierName}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {PURCHASE_STATUS_LABELS[po.status]} · %
                            {receivePercent(po.receivedTotal, po.orderedTotal)} teslim alındı
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {po.items.length} kalem bekliyor · Kod: <span className="font-medium">{po.code}</span>
                          </p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
                {pendingReceiptCount > 0 && (
                  <div className="border-t border-border bg-muted/30 p-2">
                    <Link
                      href="/stok/islem"
                      className="flex items-center justify-center rounded-md px-3 py-2 text-center text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      Tüm bekleyenleri gör ({pendingReceiptCount})
                    </Link>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Bell className="size-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Stok Uyarıları</span>
                </div>
                {criticalCount > 0 && (
                  <span className="rounded-md bg-status-critical/10 px-2 py-0.5 text-xs font-medium text-status-critical">
                    {criticalCount} kritik
                  </span>
                )}
              </div>

              <div className="max-h-80 space-y-0.5 overflow-y-auto p-2 custom-scrollbar">
                {criticalCount === 0 ? (
                  <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                    <Bell className="mb-2 size-6 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">Stok ihtiyacı yok</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Tüm ürünler güvenli stok seviyesinde.</p>
                  </div>
                ) : (
                  criticalItems.map((p) => (
                    <Link
                      key={p.id}
                      href={`/urunler/${p.id}`}
                      className="group flex items-start gap-2.5 rounded-md p-2.5 transition-colors hover:bg-muted"
                    >
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-critical" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                          {p.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Mevcut{" "}
                          <span className="font-medium tabular-nums text-status-critical">
                            {p.totalStock}
                          </span>{" "}
                          · Minimum <span className="tabular-nums">{p.minStock}</span>
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>

              {criticalCount > 0 && (
                <div className="border-t border-border bg-muted/30 p-2">
                  <Link
                    href="/urunler?stockStatus=kritik"
                    className="flex items-center justify-center rounded-md px-3 py-2 text-center text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    Tüm kritik ürünleri gör ({criticalCount})
                  </Link>
                </div>
              )}
            </>
          )}
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md py-1 pr-2 pl-1 transition-colors hover:bg-muted">
          <Avatar className="size-8">
            <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
              {status === "loading" ? "" : initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-left text-sm leading-tight sm:block">
            {status === "loading" ? (
              <span className="flex flex-col gap-1 py-0.5">
                <span className="block h-3.5 w-20 rounded bg-muted-foreground/20 animate-pulse" />
                <span className="block h-2.5 w-16 rounded bg-muted-foreground/10 animate-pulse" />
              </span>
            ) : (
              <>
                <span className="block font-medium">{name}</span>
                <span className="block text-xs text-muted-foreground">{ROLE_LABELS[role]}</span>
              </>
            )}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Hesap</DropdownMenuLabel>

          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/ayarlar" />}>
            <Settings className="size-4" />
            Ayarlar
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={async () => {
              await signOut();
              toast.warning("Oturum kapatıldı");
            }}
          >
            <LogOut className="size-4" />
            Çıkış yap
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  );
}
