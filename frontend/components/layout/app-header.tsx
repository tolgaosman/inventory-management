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
    <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-card/60 px-4 backdrop-blur md:px-6">
      <div className="hidden flex-1 md:block" />

      <div className="flex flex-1 justify-center max-w-md w-full">
        <GlobalSearch />
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">

      <Popover>
        <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors" />}>
          <Bell className="size-5" />
          {criticalCount > 0 && (
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-background" />
          )}
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-80 p-0 rounded-2xl border border-border/80 bg-background/95 shadow-xl backdrop-blur-md overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-md bg-rose-500/10 text-rose-500 dark:text-rose-400">
                <Bell className="size-3.5" />
              </div>
              <span className="text-sm font-bold text-foreground">Stok Uyarısı Bildirimleri</span>
            </div>
            {criticalCount > 0 && (
              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                {criticalCount} kritik
              </span>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {criticalCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 mb-2">
                  <Bell className="size-5" />
                </div>
                <p className="text-xs font-semibold text-foreground">Kritik stok uyarısı yok</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Tüm ürünler güvenli stok seviyesinde.</p>
              </div>
            ) : (
              getCriticalProducts()
                .slice(0, 5)
                .map((p) => (
                  <Link
                    key={p.id}
                    href={`/urunler/${p.id}`}
                    className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted/60 border border-transparent hover:border-border/40 group"
                  >
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500 dark:text-rose-400 mt-0.5">
                      <AlertTriangle className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                        {p.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <span>Mevcut: <strong className="text-rose-500 dark:text-rose-400 font-bold">{totalStockForProduct(p.id)}</strong></span>
                        <span>•</span>
                        <span>Minimum: <strong>{p.minStock}</strong></span>
                      </p>
                    </div>
                  </Link>
                ))
            )}
          </div>

          {/* Footer */}
          {criticalCount > 0 && (
            <div className="border-t border-border/60 p-2 bg-muted/20">
              <Link
                href="/urunler?stockStatus=kritik"
                className="flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-center text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
              >
                <span>Tüm kritik ürünleri gör ({criticalCount})</span>
              </Link>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 hover:bg-muted">
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
              toast.info("Yetki Rolü Değiştirildi", {
                description: `Aktif Rol: ${ROLE_LABELS[newRole]}`,
                icon: "👤",
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
