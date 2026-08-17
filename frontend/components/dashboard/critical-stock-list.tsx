"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, ShieldCheck, Download, SlidersHorizontal, MoreHorizontal, Eye, ArrowDownToLine, ShoppingCart, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/common/empty-state";
import { Can } from "@/components/common/can";
import { StockStatusBadge } from "@/components/common/status-badge";
import type { Product } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { matchesSearch } from "@/lib/api/client";
import { listCategories, listSuppliers } from "@/lib/api/catalog";
import { useAsync } from "@/lib/hooks/use-async";
import { useCurrency } from "@/lib/currency-context";
import { useSettings } from "@/lib/settings-context";
import { ProductImageThumbnail } from "@/components/common/product-image-thumbnail";

/** Columns the user can hide. Ürün / Mevcut / Durum / işlem are always shown. */
const OPTIONAL_COLUMNS = [
  { id: "supplier", label: "Tedarikçi" },
  { id: "category", label: "Kategori" },
  { id: "price", label: "Alış Fiyatı" },
  { id: "value", label: "Stok Değeri" },
] as const;

type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number]["id"];

export function CriticalStockList({
  items,
  onExport,
}: {
  items: (Product & { totalStock: number })[];
  onExport?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [supplierId, setSupplierId] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hiddenColumns, setHiddenColumns] = useState<Set<OptionalColumn>>(new Set());

  const shows = (col: OptionalColumn) => !hiddenColumns.has(col);

  function toggleColumn(col: OptionalColumn) {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  }
  const { data: categories } = useAsync(() => listCategories(), []);
  const { data: supplierResult } = useAsync(() => listSuppliers({ pageSize: 200 }), []);
  const suppliers = supplierResult?.rows;
  const { currency, rates } = useCurrency();
  const { showKurus } = useSettings();

  const categoryName = (id: string) => categories?.find((c) => c.id === id)?.name ?? "—";
  const supplierName = (id: string) => suppliers?.find((s) => s.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    return items.filter((p) => {
      if (categoryId !== "all" && p.categoryId !== categoryId) return false;
      if (supplierId !== "all" && p.supplierId !== supplierId) return false;
      return matchesSearch([p.name, p.sku, p.brand], search);
    });
  }, [items, search, categoryId, supplierId]);

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map((p) => p.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    // Kept on the base Card rather than PanelCard: the bulk-action bar sits
    // between the header and the body, which PanelCard has no slot for.
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold tracking-tight text-foreground">Kritik Stok Uyarıları</CardTitle>
          {selected.size > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-micro font-medium text-primary">
              {selected.size} seçili
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-[180px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Ürün, SKU veya marka ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8"
            />
          </div>
          <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "all")}>
            <SelectTrigger className="w-full sm:w-fit sm:min-w-[140px]">
              <SelectValue>{categoryId === "all" ? "Tüm Kategoriler" : categoryName(categoryId)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Kategoriler</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={supplierId} onValueChange={(v) => setSupplierId(v ?? "all")}>
            <SelectTrigger className="w-full sm:w-fit sm:min-w-[150px]">
              <SelectValue>{supplierId === "all" ? "Tüm Tedarikçiler" : supplierName(supplierId)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Tedarikçiler</SelectItem>
              {suppliers?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="icon" className="shrink-0" aria-label="Sütunları seç" />}
            >
              <SlidersHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Sütunlar</DropdownMenuLabel>
              {OPTIONAL_COLUMNS.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={shows(col.id)}
                  onCheckedChange={() => toggleColumn(col.id)}
                  closeOnClick={false}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="icon" className="shrink-0" aria-label="Dışa aktar" onClick={onExport}>
            <Download className="size-4" />
          </Button>
        </div>
      </CardHeader>

      {selected.size > 0 && (
        <div className="mx-(--card-spacing) flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{selected.size}</span> ürün seçildi
          </span>
          <div className="flex items-center gap-2">
            <Can permission="purchase.manage">
              <Button
                render={<Link href={`/satin-alma?productIds=${[...selected].join(",")}`} />}
                nativeButton={false}
                size="sm"
                onClick={() => {
                  toast.info("Toplu Satın Alma Talebi", {
                    description: `${selected.size} ürün için tedarik siparişi hazırlanıyor.`,
                  });
                }}
              >
                <ShoppingCart className="size-3.5" />
                Satın alma talebi
              </Button>
            </Can>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              <X className="size-3.5" />
              Seçimi temizle
            </Button>
          </div>
        </div>
      )}
      <CardContent className="min-h-0 flex-1 pt-1">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-micro text-muted-foreground">Tüm depolar geneli (depo seçiciden etkilenmez)</p>
          <Link href="/urunler?stockStatus=kritik" className="text-xs font-medium text-primary hover:underline">
            Tümünü gör
          </Link>
        </div>
        {items.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Kritik stok yok" description="Tüm ürünler minimum seviyenin üzerinde." />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Search} title="Sonuç bulunamadı" description="Arama veya filtreleri değiştirin." />
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/70 hover:bg-transparent">
                  <TableHead className="w-10 px-2 text-center">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Tümünü seç" />
                  </TableHead>
                  <TableHead>Ürün</TableHead>
                  {shows("supplier") && <TableHead className="text-center">Tedarikçi</TableHead>}
                  {shows("category") && <TableHead className="text-center">Kategori</TableHead>}
                  {shows("price") && <TableHead className="text-center">Alış Fiyatı</TableHead>}
                  <TableHead className="text-center">Mevcut / Min</TableHead>
                  {shows("value") && <TableHead className="text-center">Stok Değeri</TableHead>}
                  <TableHead className="text-center">Durum</TableHead>
                  <TableHead className="w-14 pl-2 pr-5 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                    <TableCell className="w-10 px-2 py-3 text-center">
                      <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} aria-label={`${p.name} seç`} />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-left">
                      <div className="flex items-center gap-3 min-w-0">
                        <ProductImageThumbnail src={p.imageUrl} alt={p.name} size="xs" />
                        <div className="min-w-0">
                          <Link href={`/urunler/${p.id}`} className="block truncate text-xs sm:text-[13px] font-semibold hover:underline text-foreground">
                            {p.name}
                          </Link>
                          <span className="text-micro text-muted-foreground">{p.sku}</span>
                        </div>
                      </div>
                    </TableCell>
                    {shows("supplier") && (
                      <TableCell className="px-4 py-3 text-center">
                        <span className="text-xs text-muted-foreground">{supplierName(p.supplierId)}</span>
                      </TableCell>
                    )}
                    {shows("category") && (
                      <TableCell className="px-4 py-3 text-center">
                        <span className="text-xs text-muted-foreground">{categoryName(p.categoryId)}</span>
                      </TableCell>
                    )}
                    {shows("price") && (
                      <TableCell className="px-4 py-3 text-center">
                        <span className="text-xs tabular-nums text-foreground">
                          {formatCurrency(p.purchasePrice, currency, rates?.[currency] || 1, showKurus)}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="px-4 py-3 text-center">
                      <span className="text-xs font-semibold text-muted-foreground">
                        <span className="font-semibold text-status-critical">{p.totalStock}</span> / {p.minStock}
                      </span>
                    </TableCell>
                    {shows("value") && (
                      <TableCell className="px-4 py-3 text-center">
                        <span className="text-xs tabular-nums text-foreground">
                          {formatCurrency(p.totalStock * p.purchasePrice, currency, rates?.[currency] || 1, showKurus)}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="px-4 py-3 text-center">
                      <StockStatusBadge level={p.totalStock === 0 ? "kritik" : p.totalStock < p.minStock ? "kritik" : "dusuk"} />
                    </TableCell>
                    <TableCell className="w-14 pl-2 pr-5 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon-sm" className="text-muted-foreground" />}
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem render={<Link href={`/urunler/${p.id}`} />}>
                            <Eye className="size-4" />
                            Ürün detayı
                          </DropdownMenuItem>
                          <DropdownMenuItem render={<Link href="/stok/giris" />}>
                            <ArrowDownToLine className="size-4" />
                            Stok girişi
                          </DropdownMenuItem>
                          <Can permission="purchase.manage">
                            <DropdownMenuItem
                              render={<Link href={`/satin-alma?productId=${p.id}`} />}
                              onClick={() => {
                                toast.info("Satın Alma Talebi Başlatıldı", {
                                  description: `${p.name} için tedarik siparişi hazırlanıyor.`,
                                });
                              }}
                            >
                              <ShoppingCart className="size-4" />
                              Satın alma
                            </DropdownMenuItem>
                          </Can>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
