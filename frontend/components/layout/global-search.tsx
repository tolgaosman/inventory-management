"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Package, FolderTree, Warehouse } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { NAV_ITEMS } from "./nav-config";
import { categories, products, warehouses } from "@/lib/mock/data";
import { useAuth } from "@/lib/auth";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
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

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setSearch("");
    }
  };

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
    setSearch("");
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
        <span className="flex-1 text-left">Sayfa, ürün, SKU ara…</span>
      </button>

      <CommandDialog open={open} onOpenChange={handleOpenChange} title="Arama" description="Sayfa veya ürün ara">
        <CommandInput
          placeholder="Sayfa, ürün, SKU ara…"
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          {search.trim().length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Aramak için sayfa adı, ürün veya SKU yazın.
            </div>
          ) : (
            <>
              <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>

              <CommandGroup heading="Sayfalar">
                {flatNav.map((item) => (
                  <CommandItem key={item.href} value={item.label} onSelect={() => go(item.href)} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                      <item.icon className="size-4 text-muted-foreground shrink-0" />
                      <span className="truncate font-medium text-foreground">{item.label}</span>
                    </div>
                    <span className="shrink-0 rounded border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      Sayfa
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandGroup heading="Ürünler">
                {products.map((p) => (
                  <CommandItem key={p.id} value={`${p.name} ${p.sku} ${p.categoryId}`} onSelect={() => go(`/urunler/${p.id}`)} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                      <Package className="size-4 text-primary shrink-0" />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="truncate font-medium text-foreground">{p.name}</span>
                        <span className="text-micro text-muted-foreground">SKU: {p.sku}</span>
                      </div>
                    </div>
                    <span className="shrink-0 rounded border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Ürün Yönetimi
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandGroup heading="Kategoriler">
                {categories.map((c) => (
                  <CommandItem key={c.id} value={c.name} onSelect={() => go("/kategoriler")} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                      <FolderTree className="size-4 text-indigo-500 shrink-0" />
                      <span className="truncate font-medium text-foreground">{c.name}</span>
                    </div>
                    <span className="shrink-0 rounded border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      Kategoriler
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandGroup heading="Depolar">
                {warehouses.map((w) => (
                  <CommandItem key={w.id} value={`${w.name} ${w.city}`} onSelect={() => go("/depolar")} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                      <Warehouse className="size-4 text-blue-500 shrink-0" />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="truncate font-medium text-foreground">{w.name}</span>
                        <span className="text-micro text-muted-foreground">{w.city}</span>
                      </div>
                    </div>
                    <span className="shrink-0 rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                      Depolar
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
