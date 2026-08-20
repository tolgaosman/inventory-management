"use client";

import Link from "next/link";
import Image from "next/image";
import { SidebarNav } from "./sidebar-nav";
import { MiniCalendar } from "./mini-calendar";
import browserLogo from "@/assets/browserLogo.png";

/** The brand block. Shared by the desktop rail and the mobile drawer. */
export function SidebarBrand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/panel"
      onClick={onNavigate}
      prefetch={false}
      className="flex h-16 shrink-0 items-center justify-center border-b border-sidebar-border/50 gap-1.5"
    >
      <Image src={browserLogo} alt="Envanter Yönetimi" className="h-[34px] w-auto object-contain" priority />
      <div className="text-[0.95rem] font-semibold tracking-tight mt-0.5 whitespace-nowrap">
        <span className="text-[#0a1629] dark:text-white">Envanter</span>{" "}
        <span className="text-[#14b8a6]">Yönetimi</span>
      </div>
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
