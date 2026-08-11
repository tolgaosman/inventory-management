"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { NAV_ITEMS, type NavItem } from "./nav-config";
import siteLogo from "@/assets/siteLogo.png";
import siteDarkLogo from "@/assets/siteDarkLogo.png";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      <item.icon className="size-[18px] shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function NavGroup({ item, pathname }: { item: NavItem; pathname: string }) {
  const [open, setOpen] = useState(() => item.children?.some((c) => isActive(pathname, c.href)) ?? false);
  const active = isActive(pathname, item.href);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )}
      >
        <item.icon className="size-[18px] shrink-0" />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-1 ml-[22px] flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
          {item.children!.map((child) => {
            const childActive = pathname === child.href;
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                  childActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { MiniCalendar } from "./mini-calendar";

export function AppSidebar() {
  const pathname = usePathname();
  const { can } = useAuth();

  const items = NAV_ITEMS.filter((item) => !item.permission || can(item.permission));

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex justify-between">
      <div className="flex flex-col min-h-0 flex-1">
        <div className="flex h-16 items-center justify-center py-2 shrink-0">
          <Image
            src={siteLogo}
            alt="Stok Yönetimi"
            className="h-12 w-auto object-contain dark:hidden"
            priority
          />
          <Image
            src={siteDarkLogo}
            alt="Stok Yönetimi"
            className="h-12 w-auto object-contain hidden dark:block"
            priority
          />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {items.map((item) =>
            item.children ? (
              <NavGroup key={item.href} item={item} pathname={pathname} />
            ) : (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ),
          )}
        </nav>
      </div>

      <MiniCalendar />
    </aside>
  );
}
