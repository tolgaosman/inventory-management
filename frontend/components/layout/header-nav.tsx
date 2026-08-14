"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { NAV_SECTIONS, type NavItem } from "./nav-config";
import { SidebarBrand } from "./app-sidebar";
import { SidebarNav } from "./sidebar-nav";

/**
 * The nav in a drawer, for viewports below `md` where the rail is hidden.
 * Without this there is simply no navigation on a phone.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Menüyü aç" />}
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="flex w-64 flex-col gap-0 bg-sidebar p-0 sm:max-w-64">
        <SheetTitle className="sr-only">Gezinme</SheetTitle>
        <SidebarBrand onNavigate={() => setOpen(false)} />
        <SidebarNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

interface Crumb {
  label: string;
  href: string;
}

/**
 * Derives the trail from `NAV_SECTIONS`, so a nav entry and its breadcrumb can
 * never disagree. Detail routes (`/urunler/abc123`) resolve to their parent
 * plus a generic "Detay" leaf — the record's own name isn't known here, and the
 * page's own `PageHeader` already carries it.
 */
function resolveCrumbs(pathname: string): Crumb[] {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      const candidates: { item: NavItem; parent?: NavItem }[] = [
        { item },
        ...(item.children ?? []).map((child) => ({ item: child, parent: item })),
      ];

      for (const { item: node, parent } of candidates) {
        const isExact = pathname === node.href;
        const isChildRoute = pathname.startsWith(`${node.href}/`);
        if (!isExact && !isChildRoute) continue;

        const trail: Crumb[] = [{ label: section.label, href: node.href }];
        if (parent) trail.push({ label: parent.label, href: parent.href });
        trail.push({ label: node.label, href: node.href });
        if (isChildRoute) trail.push({ label: "Detay", href: pathname });
        return trail;
      }
    }
  }
  return [];
}

export function HeaderBreadcrumb() {
  const pathname = usePathname() ?? "";
  const crumbs = resolveCrumbs(pathname);
  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb className="hidden md:block">
      <BreadcrumbList>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.href}-${i}`}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : i === 0 ? (
                  <span className="text-muted-foreground">{crumb.label}</span>
                ) : (
                  <BreadcrumbLink render={<Link href={crumb.href} />}>{crumb.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
