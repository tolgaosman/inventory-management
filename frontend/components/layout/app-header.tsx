"use client";

import Link from "next/link";
import { Bell, ChevronDown, LogOut, Settings, UserCog } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@/lib/types";
import { getCriticalProducts } from "@/lib/mock/dashboard";
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

const ROLE_ORDER: Role[] = ["yonetici", "satinalma", "depo"];

export function AppHeader() {
  const { name, initials, role, setRole } = useAuth();
  const criticalCount = getCriticalProducts().length;

  return (
    <header className="flex h-16 items-center gap-4 border-b border-border bg-card/60 px-4 backdrop-blur md:px-6">
      <div className="flex-1">
        <GlobalSearch />
      </div>

      <Popover>
        <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative rounded-full" />}>
          <Bell className="size-[18px]" />
          {criticalCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-status-critical text-[10px] font-medium text-white">
              {criticalCount}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-0">
          <div className="border-b border-border px-3 py-2 text-sm font-medium">Bildirimler</div>
          <div className="max-h-72 overflow-y-auto p-1">
            {criticalCount === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">Kritik stok yok.</p>
            ) : (
              getCriticalProducts()
                .slice(0, 5)
                .map((p) => (
                  <Link
                    key={p.id}
                    href={`/urunler/${p.id}`}
                    className="block rounded-lg px-2 py-2 text-sm hover:bg-muted"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      Stok minimum seviyenin altında
                    </span>
                  </Link>
                ))
            )}
          </div>
          <div className="border-t border-border p-1">
            <Link
              href="/urunler?stockStatus=kritik"
              className="block rounded-lg px-2 py-1.5 text-center text-xs font-medium text-primary hover:bg-muted"
            >
              Tüm kritik ürünleri gör
            </Link>
          </div>
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
          <DropdownMenuItem render={<Link href="/ayarlar" />}>
            <Settings className="size-4" />
            Ayarlar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-2">
            <UserCog className="size-3.5" /> Rolü değiştir (demo)
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={role} onValueChange={(v) => setRole(v as Role)}>
            {ROLE_ORDER.map((r) => (
              <DropdownMenuRadioItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">
            <LogOut className="size-4" />
            Çıkış yap
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
