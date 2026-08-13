"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { NAV_SECTIONS, type NavItem } from "./nav-config";
import { MiniCalendar } from "./mini-calendar";
import siteLogo from "@/assets/siteLogo.png";
import siteDarkLogo from "@/assets/siteDarkLogo.png";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Shared row chrome: an accent rail on the left marks the active item. */
const rowBase =
  "group relative flex items-center gap-2.5 rounded-md py-2 pr-3 pl-3 text-sm transition-colors before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-0.5 before:rounded-full before:transition-colors";
const rowActive =
  "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:bg-sidebar-primary";
const rowIdle =
  "text-sidebar-foreground/75 before:bg-transparent hover:bg-sidebar-accent/50 hover:text-sidebar-foreground";

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  return (
    <Link href={item.href} className={cn(rowBase, active ? rowActive : rowIdle)}>
      <item.icon className="size-4 shrink-0" />
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
        className={cn(rowBase, "w-full", active ? rowActive : rowIdle)}
      >
        <item.icon className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-0.5 ml-[26px] flex flex-col gap-0.5 border-l border-sidebar-border pl-2.5">
          {item.children!.map((child) => {
            const childActive = pathname === child.href;
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  childActive
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
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

export function AppSidebar() {
  const pathname = usePathname();
  const { can } = useAuth();

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.permission || can(item.permission)),
  })).filter((section) => section.items.length > 0);

  return (
    <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-16 shrink-0 items-center justify-center border-b border-sidebar-border py-2 px-4">
          <Image src={siteLogo} alt="Stok Yönetimi" className="h-11 w-auto object-contain dark:hidden" priority />
          <Image
            src={siteDarkLogo}
            alt="Stok Yönetimi"
            className="hidden h-11 w-auto object-contain dark:block"
            priority
          />
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 custom-scrollbar">
          {sections.map((section) => (
            <div key={section.label} className="space-y-1">
              <p className="px-3 pb-1 text-micro tracking-wide text-sidebar-foreground/45 uppercase">
                {section.label}
              </p>
              {section.items.map((item) =>
                item.children ? (
                  <NavGroup key={item.href} item={item} pathname={pathname} />
                ) : (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ),
              )}
            </div>
          ))}
        </nav>
      </div>

      <MiniCalendar />
    </aside>
  );
}
