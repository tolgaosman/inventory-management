"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { NAV_ITEMS } from "./nav-config";
import { products } from "@/lib/mock/data";
import { useAuth } from "@/lib/auth";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { can } = useAuth();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const flatNav = useMemo(() => {
    const all = NAV_ITEMS.flatMap((item) => [item, ...(item.children ?? [])]).filter(
      (item) => !item.permission || can(item.permission),
    );
    // A parent and one of its children can share an href (e.g. "Stok
    // Hareketleri" ↔ "Hareket Geçmişi" both point at /stok/hareketler);
    // href is used as the React key below, so de-dupe by href, keeping the
    // first (parent) occurrence.
    return [...new Map(all.map((item) => [item.href, item])).values()];
  }, [can]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-sm items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Ara</span>
        <kbd className="hidden items-center gap-0.5 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-micro text-muted-foreground sm:inline-flex">
          Ctrl K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Arama" description="Sayfa veya ürün ara">
        <CommandInput placeholder="Sayfa, ürün, SKU ara…" />
        <CommandList>
          <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
          <CommandGroup heading="Sayfalar">
            {flatNav.map((item) => (
              <CommandItem key={item.href} onSelect={() => go(item.href)}>
                <item.icon className="size-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Ürünler">
            {products.slice(0, 8).map((p) => (
              <CommandItem key={p.id} onSelect={() => go(`/urunler/${p.id}`)}>
                {p.name}
                <span className="ml-auto text-xs text-muted-foreground">{p.sku}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
