"use client";

import Link from "next/link";
import { Bell, ChevronDown, LogOut, Settings, UserCog, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@/lib/types";
import { getCriticalProducts } from "@/lib/mock/dashboard";
import { totalStockForProduct } from "@/lib/mock/data";
import { GlobalSearch } from "./global-search";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { useSettings } from "@/lib/settings-context";

const ROLE_ORDER: Role[] = ["yonetici", "satinalma", "depo"];

export function AppHeader() {
  const { name, initials, role, setRole } = useAuth();
  const { notifications } = useSettings();
  const criticalCount = notifications.notifyStock ? getCriticalProducts().length : 0;

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-card px-4 md:px-6">
      <div className="hidden flex-1 md:block" />

      <div className="flex flex-1 justify-center max-w-md w-full">
        <GlobalSearch />
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">

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
              getCriticalProducts()
                .slice(0, 5)
                .map((p) => (
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
                          {totalStockForProduct(p.id)}
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
          <DropdownMenuLabel className="flex items-center gap-2">
            <UserCog className="size-3.5" /> Rolü değiştir (demo)
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={role}
            onValueChange={(v) => {
              const newRole = v as Role;
              setRole(newRole);
              toast.info("Yetki rolü değiştirildi", {
                description: `Aktif rol: ${ROLE_LABELS[newRole]}`,
              });
            }}
          >
            {ROLE_ORDER.map((r) => (
              <DropdownMenuRadioItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/ayarlar" />}>
            <Settings className="size-4" />
            Ayarlar
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              toast.warning("Oturum Kapatıldı", {
                description: "Giriş sayfasına yönlendiriliyorsunuz...",
              });
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
