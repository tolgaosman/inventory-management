"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useCurrency } from "@/lib/currency-context";
import { useSettings } from "@/lib/settings-context";
import { useAuth } from "@/lib/auth";
import { PRODUCT_STATUS_LABELS } from "@/lib/constants";
import { buildReportExcel } from "@/lib/export/excel";
import { buildReportPdf } from "@/lib/export/pdf";
import { Checkbox } from "@/components/ui/checkbox";
import { ProductImportModal } from "@/components/products/product-import-modal";
import {
  Plus,
  Search,
  Download,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  CircleDot,
  X,
  Loader2,
  Package,
  AlertTriangle,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  FileSpreadsheet,
  CheckCircle2,
} from "lucide-react";
import { ProductImageThumbnail } from "@/components/common/product-image-thumbnail";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { PageHeader } from "@/components/common/page-header";
import { Can } from "@/components/common/can";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatGrid } from "@/components/common/stat-card";
import { Section, SectionStack } from "@/components/common/section";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable } from "@/components/data-table/data-table";
import { StockStatusBadge, ProductStatusBadge } from "@/components/common/status-badge";
import { ProductFormSheet } from "@/components/products/product-form-sheet";
import { StockMovementSheet, type StockMovementMode } from "@/components/products/stock-movement-sheet";
import { useAsync } from "@/lib/hooks/use-async";
import { useChangedSince } from "@/lib/hooks/use-reset-on-change";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  bulkSetProductStatus,
  bulkDeleteProducts,
  type ProductRow,
  type ProductQuery,
} from "@/lib/api/products";
import { listCategories, listWarehouses, listSuppliers } from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/client";
import { formatCurrency, formatNumber } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/constants";
import { downloadBlob, reportFilename } from "@/lib/export/download";
import type { ReportData } from "@/lib/export/report-data";
import type { Product } from "@/lib/types";

const STOCK_STATUS_LABELS: Record<"kritik" | "dusuk" | "normal", string> = {
  kritik: "Kritik",
  dusuk: "Düşük",
  normal: "Normal",
};

function stockLevel(row: ProductRow): "kritik" | "dusuk" | "normal" {
  if (row.critical) return "kritik";
  if (row.totalStock < row.minStock * 1.5) return "dusuk";
  return "normal";
}

export function ProductsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currency, rates } = useCurrency();
  const { company, showKurus } = useSettings();
  const { name } = useAuth();

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [search, setSearch] = useState(searchInput);
  const [categoryId, setCategoryId] = useState(searchParams.get("categoryId") ?? "all");
  const [stockStatus, setStockStatus] = useState(searchParams.get("stockStatus") ?? "all");
  const [warehouseId, setWarehouseId] = useState(searchParams.get("warehouseId") ?? "all");
  const [supplierId, setSupplierId] = useState(searchParams.get("supplierId") ?? "all");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [sorting, setSorting] = useState<SortingState>(() => {
    const sortBy = searchParams.get("sortBy");
    return sortBy ? [{ id: sortBy, desc: searchParams.get("sortDir") === "desc" }] : [];
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | undefined>(undefined);
  const [deleting, setDeleting] = useState<ProductRow | undefined>(undefined);
  const [movement, setMovement] = useState<{ product: ProductRow; mode: StockMovementMode } | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const exportGuard = useSubmitGuard();

  async function handleBulkStatus(targetStatus: "aktif" | "pasif") {
    if (selectedIds.size === 0) return;
    setIsBulkProcessing(true);
    try {
      const res = await bulkSetProductStatus(Array.from(selectedIds), targetStatus);
      toast.success(`${res.updatedCount} ürün durumu "${targetStatus === "aktif" ? "Aktif" : "Pasif"}" olarak güncellendi.`);
      setSelectedIds(new Set());
      refetch();
    } catch {
      toast.error("Toplu durum güncellenemedi");
    } finally {
      setIsBulkProcessing(false);
    }
  }

  async function handleBulkDeleteSubmit() {
    if (selectedIds.size === 0) return;
    setIsBulkProcessing(true);
    try {
      const res = await bulkDeleteProducts(Array.from(selectedIds));
      if (res.deletedCount > 0) {
        toast.success(`${res.deletedCount} ürün kataloktan silindi.`);
      }
      if (res.failedSkus.length > 0) {
        toast.warning(`${res.failedSkus.length} ürün stok hareketi olduğu için silinemedi.`, {
          description: `Silinemeyen SKU'lar: ${res.failedSkus.slice(0, 3).join(", ")}${res.failedSkus.length > 3 ? "..." : ""}`,
        });
      }
      setSelectedIds(new Set());
      setBulkConfirmOpen(false);
      refetch();
    } catch {
      toast.error("Toplu silme sırasında hata oluştu");
    } finally {
      setIsBulkProcessing(false);
    }
  }

  // Debounce free-text search input.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const rate = rates?.[currency] || 1;
  const parsedMin = minPrice ? parseFloat(minPrice) : NaN;
  const parsedMax = maxPrice ? parseFloat(maxPrice) : NaN;

  const query: ProductQuery = useMemo(
    () => ({
      search: search || undefined,
      categoryId: categoryId === "all" ? undefined : categoryId,
      stockStatus: stockStatus === "all" ? undefined : (stockStatus as "kritik" | "dusuk" | "normal"),
      warehouseId: warehouseId === "all" ? undefined : warehouseId,
      supplierId: supplierId === "all" ? undefined : supplierId,
      minPrice: !isNaN(parsedMin) ? parsedMin * rate : undefined,
      maxPrice: !isNaN(parsedMax) ? parsedMax * rate : undefined,
      page,
      pageSize: PAGE_SIZE,
      sortBy: sorting[0]?.id,
      sortDir: sorting[0]?.desc ? "desc" : "asc",
    }),
    [search, categoryId, stockStatus, warehouseId, supplierId, parsedMin, parsedMax, rate, page, sorting],
  );

  // Reset to page 1 whenever a filter (anything but page itself) changes.
  const filterKey = JSON.stringify({ search, categoryId, stockStatus, warehouseId, supplierId, minPrice, maxPrice, sorting });
  if (useChangedSince(filterKey) && page !== 1) setPage(1);

  // Keep the URL in sync so links like /urunler?stockStatus=kritik round-trip,
  // and so page/sorting survive a refresh or a shared link.
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (categoryId !== "all") params.set("categoryId", categoryId);
    if (stockStatus !== "all") params.set("stockStatus", stockStatus);
    if (warehouseId !== "all") params.set("warehouseId", warehouseId);
    if (supplierId !== "all") params.set("supplierId", supplierId);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (page > 1) params.set("page", String(page));
    if (sorting[0]) {
      params.set("sortBy", sorting[0].id);
      params.set("sortDir", sorting[0].desc ? "desc" : "asc");
    }
    const qs = params.toString();
    router.replace(qs ? `/urunler?${qs}` : "/urunler", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryId, stockStatus, warehouseId, supplierId, minPrice, maxPrice, page, sorting]);

  const { status, data, staleData, error, refetch } = useAsync(() => listProducts(query), [
    JSON.stringify(query),
  ]);
  const view = data ?? staleData;

  const { data: refData } = useAsync(
    () => Promise.all([listCategories(), listWarehouses(), listSuppliers({ pageSize: 1000 })]),
    [],
  );
  const categories = (refData?.[0] ?? []).filter((c) => c.parentId !== null);
  // Memoized so the columns useMemo below (which depends on `warehouses`)
  // doesn't recompute every render just because `refData?.[1] ?? []` builds
  // a fresh empty-array reference each time.
  const warehouses = useMemo(() => refData?.[1] ?? [], [refData]);
  const suppliers = refData?.[2]?.rows ?? [];

  const isFiltered = Boolean(
    search || categoryId !== "all" || stockStatus !== "all" || warehouseId !== "all" || supplierId !== "all" || minPrice || maxPrice,
  );

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setCategoryId("all");
    setStockStatus("all");
    setWarehouseId("all");
    setSupplierId("all");
    setMinPrice("");
    setMaxPrice("");
  }

  async function handleSaved(values: Omit<Product, "id" | "status">) {
    try {
      if (editing) {
        await updateProduct(editing.id, values);
      } else {
        await createProduct(values);
      }
      refetch();
    } catch (err) {
      toast.error(editing ? "Ürün güncellenemedi" : "Ürün oluşturulamadı", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
      throw err;
    }
  }

  const handleToggleStatus = useCallback(
    async (row: ProductRow) => {
      try {
        await toggleProductStatus(row.id);
        toast.success(row.status === "aktif" ? "Ürün pasife alındı." : "Ürün aktife alındı.");
        refetch();
      } catch (err) {
        toast.error("Durum güncellenemedi", {
          description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
        });
      }
    },
    [refetch],
  );

  async function handleDelete() {
    if (!deleting) return;
    try {
      await deleteProduct(deleting.id);
      toast.success("Ürün silindi.", { description: `${deleting.name} kataloktan kaldırıldı.` });
      setDeleting(undefined);
      refetch();
    } catch (err) {
      toast.error("Ürün silinemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
    }
  }

  async function handleExportFormat(format: "excel" | "pdf", onlySelected?: boolean) {
    await exportGuard.guard(async () => {
      try {
        const all = await listProducts({ ...query, page: 1, pageSize: 10000 });
        let exportRows = all.rows;
        if (onlySelected && selectedIds.size > 0) {
          exportRows = exportRows.filter((p) => selectedIds.has(p.id));
        }

        const reportTitle = onlySelected ? `Seçili Ürünler (${exportRows.length} Adet)` : "Ürün Yönetimi";

        const report: ReportData = {
          company: company.companyName,
          title: reportTitle,
          generatedAt: new Date(),
          rangeLabel: "Tüm Zamanlar",
          generatedBy: name,
          currency: currency,
          kpis: [],
          sections: [
            {
              title: reportTitle,
              columns: ["Ürün Adı", "SKU", "Barkod", "Kategori", "Marka", "Birim", "Alış Fiyatı", "Satış Fiyatı", "Mevcut Stok", "Durum"],
              numericColumns: [6, 7, 8],
              currencyColumns: [6, 7],
              emptyMessage: "Ürün bulunamadı.",
              rows: exportRows.map((p) => [
                p.name, p.sku, p.barcode, p.categoryName, p.brand, p.unit,
                p.purchasePrice / (rates?.[currency] || 1), p.salePrice / (rates?.[currency] || 1), p.totalStock, PRODUCT_STATUS_LABELS[p.status]
              ])
            }
          ]
        };

        const ext = format === "excel" ? "xlsx" : "pdf";
        const filename = reportFilename(ext).replace("stok-raporu", onlySelected ? "secili-urunler" : "urun-yonetimi");
        
        if (format === "excel") {
           downloadBlob(buildReportExcel(report, ["all"]), filename);
           toast.success("Excel Raporu İndirildi", { description: `${exportRows.length} ürün Excel (.xlsx) olarak kaydedildi.` });
        } else {
           downloadBlob(await buildReportPdf(report, ["all"]), filename);
           toast.success("PDF Raporu İndirildi", { description: `${exportRows.length} ürün PDF olarak kaydedildi.` });
        }
      } catch (err) {
        toast.error("Dışa aktarılamadı", {
          description: err instanceof Error ? err.message : "Beklenmedik bir hata oluştu.",
        });
      }
    });
  }

  const columns = useMemo<ColumnDef<ProductRow, unknown>[]>(
    () => [
      {
        id: "select",
        header: () => {
          const pageRows = view?.rows ?? [];
          const allSelected = pageRows.length > 0 && pageRows.every((r) => selectedIds.has(r.id));

          return (
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (checked) {
                    pageRows.forEach((r) => next.add(r.id));
                  } else {
                    pageRows.forEach((r) => next.delete(r.id));
                  }
                  return next;
                });
              }}
              aria-label="Tümünü seç"
            />
          );
        },
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.has(row.original.id)}
            onCheckedChange={(checked) => {
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (checked) next.add(row.original.id);
                else next.delete(row.original.id);
                return next;
              });
            }}
            aria-label="Ürün seç"
          />
        ),
        enableSorting: false,
        meta: { className: "w-10 text-center" },
      },
      {
        id: "name",
        accessorKey: "name",
        header: "Ürün",
        meta: { className: "min-w-[240px]" },
        cell: ({ row }) => (
          <Link href={`/urunler/${row.original.id}`} className="flex items-center gap-3 group hover:text-primary">
            <ProductImageThumbnail src={row.original.imageUrl} alt={row.original.name} size="sm" />
            <div>
              <span className="font-medium text-foreground group-hover:text-primary transition-colors">{row.original.name}</span>
              <span className="block text-xs text-muted-foreground">{row.original.brand}</span>
            </div>
          </Link>
        ),
      },
      {
        id: "sku",
        accessorKey: "sku",
        header: "SKU / Barkod",
        meta: { className: "min-w-[130px]" },
        cell: ({ row }) => (
          <div>
            <span className="font-mono text-xs">{row.original.sku}</span>
            <p className="font-mono text-micro text-muted-foreground">{row.original.barcode}</p>
          </div>
        ),
      },
      {
        id: "categoryName",
        accessorKey: "categoryName",
        header: "Kategori",
        meta: { className: "min-w-[130px]" },
        cell: ({ row }) => row.original.categoryName,
      },
      {
        id: "totalStock",
        accessorKey: "totalStock",
        header: "Stok",
        meta: { className: "min-w-[120px]" },
        cell: ({ row }) => (
          <div className="tabular-nums">
            <span className="font-medium text-foreground">{formatNumber(row.original.totalStock)}</span>{" "}
            <span className="text-xs text-muted-foreground">{row.original.unit}</span>
            {row.original.warehouseStock != null ? (
              <p className="text-xs text-muted-foreground">
                {warehouses.find((w) => w.id === warehouseId)?.name ?? "Seçili depo"}:{" "}
                {formatNumber(row.original.warehouseStock)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                min {row.original.minStock} / maks {row.original.maxStock}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "stockLevel",
        header: "Stok Durumu",
        enableSorting: false,
        meta: { className: "min-w-[140px] text-center" },
        cell: ({ row }) => (
          <div className="flex justify-center">
            <StockStatusBadge level={stockLevel(row.original)} />
          </div>
        ),
      },
      {
        id: "salePrice",
        accessorKey: "salePrice",
        header: "Fiyat",
        meta: { className: "min-w-[140px] text-right" },
        cell: ({ row }) => {
          const rate = rates?.[currency] || 1;
          return (
            <div className="tabular-nums">
              <span className="font-medium text-foreground">{formatCurrency(row.original.salePrice, currency, rate, showKurus)}</span>
              <p className="text-xs text-muted-foreground">Alış {formatCurrency(row.original.purchasePrice, currency, rate, showKurus)}</p>
            </div>
          );
        },
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Durum",
        meta: { className: "min-w-[120px] text-center" },
        cell: ({ row }) => (
          <div className="flex justify-center">
            <ProductStatusBadge status={row.original.status} />
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { className: "w-12 text-right" },
        cell: ({ row }) => {
          const product = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" className="size-8">
                    <MoreHorizontal className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem render={<Link href={`/urunler/${product.id}`} />}>
                  <Eye className="size-4" />
                  Detay Göster
                </DropdownMenuItem>
                <Can permission="products.manage">
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={product.status === "pasif"}
                      onClick={() => setMovement({ product, mode: "giris" })}
                    >
                      <ArrowDownToLine className="size-4 text-status-good" />
                      Stok Girişi Yap
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={product.status === "pasif"}
                      onClick={() => setMovement({ product, mode: "cikis" })}
                    >
                      <ArrowUpFromLine className="size-4 text-status-critical" />
                      Stok Çıkışı Yap
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={product.status === "pasif"}
                      onClick={() => setMovement({ product, mode: "transfer" })}
                    >
                      <ArrowLeftRight className="size-4 text-primary" />
                      Depolar Arası Transfer
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setEditing(product);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                      Düzenle
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleStatus(product)}>
                      <CircleDot className="size-4" />
                      {product.status === "aktif" ? "Pasife Al" : "Aktife Al"}
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleting(product)}>
                      <Trash2 className="size-4" />
                      Sil
                    </DropdownMenuItem>
                  </>
                </Can>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [currency, rates, warehouses, warehouseId, selectedIds, view, handleToggleStatus],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ürün Yönetimi"
        description="Katalogdaki tüm ürünler, stok seviyeleri ve fiyatlar."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" disabled={exportGuard.pending}>
                    {exportGuard.pending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    Dışa Aktar
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportFormat("excel")}>Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportFormat("pdf")}>PDF (.pdf)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Can permission="products.manage">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportOpen(true)}
                className="gap-1.5 border-status-good text-status-good hover:bg-status-good/10"
              >
                <FileSpreadsheet className="size-4 text-status-good" />
                İçe Aktar (Excel)
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditing(undefined);
                  setFormOpen(true);
                }}
              >
                <Plus className="size-4" />
                Yeni Ürün
              </Button>
            </Can>
          </>
        }
      />

      <SectionStack className={status === "loading" ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <Section index={0}>
      <StatGrid
        className="grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        items={[
          { icon: Package, tint: "blue", label: "Toplam Ürün", value: formatNumber(view?.stats.total ?? 0) },
          { icon: AlertTriangle, tint: "red", label: "Kritik Stok", value: formatNumber(view?.stats.critical ?? 0) },
          { icon: CircleDot, tint: "amber", label: "Pasif Ürün", value: formatNumber(view?.stats.passive ?? 0) },
          {
            icon: Wallet,
            tint: "green",
            label: "Stok Değeri",
            value: formatCurrency(view?.stats.stockValue ?? 0, currency, rates?.[currency] || 1, showKurus),
          },
        ]}
      />
      </Section>

      <Section index={1}>
      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Ürün adı, SKU, barkod veya marka ara…"
                className="h-9 pl-8"
              />
            </div>
            {isFiltered && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
                <X className="size-4" />
                Filtreleri Temizle
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Select value={categoryId} onValueChange={(v) => setCategoryId((v as string) ?? "all")}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {categoryId === "all" ? "Tüm Kategoriler" : categories.find(c => c.id === categoryId)?.name || "Kategori"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kategoriler</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={stockStatus} onValueChange={(v) => setStockStatus((v as string) ?? "all")}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {stockStatus === "all" ? "Tüm Stok Durumları" : STOCK_STATUS_LABELS[stockStatus as keyof typeof STOCK_STATUS_LABELS] || "Stok Durumu"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Stok Durumları</SelectItem>
                {(Object.keys(STOCK_STATUS_LABELS) as Array<keyof typeof STOCK_STATUS_LABELS>).map((k) => (
                  <SelectItem key={k} value={k}>
                    {STOCK_STATUS_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={warehouseId} onValueChange={(v) => setWarehouseId((v as string) ?? "all")}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {warehouseId === "all" ? "Tüm Depolar" : warehouses.find(w => w.id === warehouseId)?.name || "Depo"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Depolar</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={supplierId} onValueChange={(v) => setSupplierId((v as string) ?? "all")}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {supplierId === "all" ? "Tüm Tedarikçiler" : suppliers.find(s => s.id === supplierId)?.name || "Tedarikçi"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Tedarikçiler</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder={`Min (${currency.toUpperCase()})`}
                className="h-9"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="number"
                min={0}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder={`Maks (${currency.toUpperCase()})`}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      </Section>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 px-4 rounded-xl border border-primary/30 bg-primary/10 dark:bg-primary/15 shadow-soft animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Badge variant="secondary" className="bg-primary text-primary-foreground font-semibold px-2 py-0.5">
              {selectedIds.size}
            </Badge>
            <span>Ürün Seçildi</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkStatus("aktif")}
              disabled={isBulkProcessing}
              className="h-8 gap-1 text-xs border-status-good text-status-good hover:bg-status-good/10"
            >
              <CheckCircle2 className="size-3.5 text-status-good" />
              Toplu Aktife Al
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkStatus("pasif")}
              disabled={isBulkProcessing}
              className="h-8 gap-1 text-xs border-status-warning/30 text-status-warning-foreground hover:bg-status-warning/10 "
            >
              <CircleDot className="size-3.5 text-status-warning-foreground" />
              Toplu Pasife Al
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExportFormat("excel", true)}
              disabled={exportGuard.pending}
              className="h-8 gap-1 text-xs border-primary text-primary hover:bg-primary/10 "
            >
              <FileSpreadsheet className="size-3.5 text-primary" />
              Dışa Aktar (Excel)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExportFormat("pdf", true)}
              disabled={exportGuard.pending}
              className="h-8 gap-1 text-xs border-status-critical text-status-critical hover:bg-status-critical/10 "
            >
              <Download className="size-3.5 text-status-critical" />
              Dışa Aktar (PDF)
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setBulkConfirmOpen(true)}
              disabled={isBulkProcessing}
              className="h-8 gap-1 text-xs"
            >
              <Trash2 className="size-3.5" />
              Toplu Sil
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Seçimi Temizle
            </Button>
          </div>
        </div>
      )}

      <Section index={2}>
      <DataTable
        columns={columns}
        data={view?.rows ?? []}
        total={view?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        loading={!view}
        error={status === "error" && !view ? error : undefined}
        onRetry={refetch}
        sorting={sorting}
        onSortingChange={setSorting}
        isFiltered={isFiltered}
        emptyTitle="Henüz ürün yok"
        emptyDescription="Katalogda henüz bir ürün bulunmuyor."
      />
      </Section>
      </SectionStack>

      <ProductImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={refetch}
        categories={categories}
        suppliers={suppliers}
        existingProducts={view?.rows ?? []}
      />

      <ProductFormSheet open={formOpen} onOpenChange={setFormOpen} product={editing} onSaved={handleSaved} categories={categories} suppliers={suppliers} />

      <StockMovementSheet
        open={Boolean(movement)}
        onOpenChange={(open) => !open && setMovement(undefined)}
        product={movement?.product}
        mode={movement?.mode ?? "giris"}
        warehouses={warehouses}
        suppliers={suppliers}
        onDone={refetch}
      />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ürünü sil</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `"${deleting.name}" kataloktan kalıcı olarak silinecek. Bu işlem geri alınamaz.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive-solid"
              onClick={handleDelete}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Seçili {selectedIds.size} Ürünü Sil</AlertDialogTitle>
            <AlertDialogDescription>
              Seçtiğiniz {selectedIds.size} ürün kataloktan kalıcı olarak silinecektir. Stok hareketi (giriş/çıkış/transfer) olan ürünler güvenlik nedeniyle atlanacaktır. Devam etmek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive-solid"
              onClick={handleBulkDeleteSubmit}
              disabled={isBulkProcessing}
            >
              {isBulkProcessing ? "Siliniyor..." : "Toplu Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
