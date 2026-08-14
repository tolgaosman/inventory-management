"use client";

import Link from "next/link";
import Image from "next/image";
import { SidebarNav } from "./sidebar-nav";
import { MiniCalendar } from "./mini-calendar";
import siteLogo from "@/assets/siteLogo.png";
import siteDarkLogo from "@/assets/siteDarkLogo.png";

/** The brand block. Shared by the desktop rail and the mobile drawer. */
export function SidebarBrand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/panel"
      onClick={onNavigate}
      className="flex h-16 shrink-0 items-center justify-center border-b border-sidebar-border/50"
    >
      <Image src={siteLogo} alt="Stok Yönetimi" className="h-10 w-auto object-contain dark:hidden" priority />
      <Image
        src={siteDarkLogo}
        alt="Stok Yönetimi"
        className="hidden h-10 w-auto object-contain dark:block"
        priority
      />
    </Link>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex min-h-0 flex-1 flex-col">
        <SidebarBrand />
        <SidebarNav />
      </div>

      <div className="flex shrink-0 flex-col px-2 pb-2">
        <MiniCalendar />
      </div>
    </aside>
  );
}
