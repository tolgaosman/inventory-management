"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { NAV_SECTIONS, type NavItem } from "./nav-config";

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const linkBase =
  "flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-[13.5px] font-medium transition-colors ease-out-strong";
/**
 * Active state matches the selected-row language used across the app
 * (`bg-primary/10 text-primary font-semibold`) with a clean button look.
 */
const linkActive = "bg-primary/10 font-semibold text-primary";
const linkIdle =
  "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground";

function SidebarLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  return (
    <Link href={item.href} onClick={onNavigate} prefetch={false} className={cn(linkBase, active ? linkActive : linkIdle)}>
      <item.icon className="size-3.5 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function SidebarGroup({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
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
                onClick={onNavigate}
                prefetch={false}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-1 text-[12px] transition-colors",
                  childActive
                    ? "bg-primary/10 font-semibold text-primary"
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

/**
 * The nav body itself, with no surface of its own. Rendered twice: inside the
 * desktop `<aside>` and inside the mobile drawer, so the two can never drift.
 * `onNavigate` lets the drawer close itself on selection.
 */
export function SidebarNav({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const pathname = usePathname();
  const { can } = useAuth();

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items
      .map((item) => {
        if (!item.children) return item;
        const filteredChildren = item.children.filter((child) => {
          if (!child.permission) return true;
          if (Array.isArray(child.permission)) return child.permission.some(can);
          return can(child.permission);
        });
        if (filteredChildren.length === 1) {
          const only = filteredChildren[0];
          return { ...item, href: only.href, label: only.label, icon: only.icon, children: undefined };
        }
        return { ...item, children: filteredChildren.length > 0 ? filteredChildren : undefined };
      })
      .filter((item) => {
        if (!item.permission) return true;
        if (Array.isArray(item.permission)) return item.permission.some(can);
        return can(item.permission);
      }),
  })).filter((section) => section.items.length > 0);

  return (
    <nav className={cn("flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 custom-scrollbar", className)}>
      {sections.map((section) => (
        <div key={section.label} className="flex flex-col gap-0.5">
          <div className="px-3 pb-0.5 text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-semibold">{section.label}</div>
          {section.items.map((item) =>
            item.children ? (
              <SidebarGroup key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
            ) : (
              <SidebarLink
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
                onNavigate={onNavigate}
              />
            ),
          )}
        </div>
      ))}
    </nav>
  );
}
