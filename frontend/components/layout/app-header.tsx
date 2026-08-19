"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, LogOut, Settings, AlertTriangle, Warehouse, CalendarRange, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";

import { getCriticalStockNotifications, RANGE_LABELS, type DateRangePreset } from "@/lib/api/dashboard";
import { listWarehouses } from "@/lib/api/catalog";
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
  const { name, initials, role, signOut } = useAuth();
  const { notifications } = useSettings();
  const pathname = usePathname();
  const isPanel = pathname?.replace(/\/$/, "") === "/panel";

  const { data: notif } = useAsync(
    () => (notifications.notifyStock ? getCriticalStockNotifications(5) : Promise.resolve({ total: 0, items: [] })),
    [notifications.notifyStock],
  );
  const criticalCount = notif?.total ?? 0;
  const criticalItems = notif?.items ?? [];

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
        <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors" />}>
          <Bell className="size-5" />
          {criticalCount > 0 && (
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-card" />
          )}
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-80 overflow-hidden rounded-lg border border-border bg-popover p-0 shadow-soft">
          {/* Header */}
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

          {/* List */}
          <div className="max-h-80 space-y-0.5 overflow-y-auto p-2 custom-scrollbar">
            {!notifications.notifyStock ? (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                <Bell className="mb-2 size-6 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Kritik stok bildirimleri kapalı</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Bildirimi{" "}
                  <Link href="/ayarlar" className="font-medium text-primary hover:underline">
                    Ayarlar
                  </Link>
                  &apos;dan tekrar açabilirsiniz.
                </p>
              </div>
            ) : criticalCount === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                <Bell className="mb-2 size-6 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Kritik stok uyarısı yok</p>
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

          {/* Footer */}
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
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md py-1 pr-2 pl-1 transition-colors hover:bg-muted">
          <Avatar className="size-8">
            <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-left text-sm leading-tight sm:block">
            <span className="block font-medium">{name}</span>
            <span className="block text-xs text-muted-foreground">{ROLE_LABELS[role]}</span>
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
