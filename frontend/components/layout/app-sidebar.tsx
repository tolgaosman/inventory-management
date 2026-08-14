"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
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

const linkBase = "flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors text-[13px] font-medium";
const linkActive = "bg-primary text-primary-foreground";
const linkIdle = "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground";

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href} className={cn(linkBase, active ? linkActive : linkIdle)}>
      <item.icon className="size-3.5 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function SidebarGroup({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href) || (item.children?.some((c) => isActive(pathname, c.href)) ?? false);
  const [open, setOpen] = useState(active);

  return (
    <div className="flex w-full flex-col gap-0.5">
      <button 
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(linkBase, linkIdle, "justify-between", active && !open && "text-primary")}
      >
        <div className="flex items-center gap-3">
          <item.icon className="size-3.5 shrink-0" />
          <span className="truncate">{item.label}</span>
        </div>
        <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", open ? "rotate-180" : "")} />
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 pl-8 pr-2 pt-0.5">
          {item.children!.map((child) => {
            const childActive = pathname === child.href;
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-1.5 text-[13px] transition-colors",
                  childActive
                    ? "bg-accent font-medium text-foreground"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <span className="truncate">{child.label}</span>
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
        <Link href="/panel" className="flex items-center justify-center h-16 shrink-0 border-b border-sidebar-border/50">
          <Image src={siteLogo} alt="Stok Yönetimi" className="h-10 w-auto object-contain dark:hidden" priority />
          <Image
            src={siteDarkLogo}
            alt="Stok Yönetimi"
            className="hidden h-10 w-auto object-contain dark:block"
            priority
          />
        </Link>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-6 custom-scrollbar">
          {sections.map((section) => (
            <div key={section.label} className="flex flex-col gap-1">
              <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {section.label}
              </div>
              {section.items.map((item) =>
                item.children ? (
                  <SidebarGroup key={item.href} item={item} pathname={pathname} />
                ) : (
                  <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
                ),
              )}
            </div>
          ))}
        </nav>
      </div>

      <div className="flex shrink-0 flex-col px-2 pb-4">
        <MiniCalendar />
      </div>
    </aside>
  );
}
