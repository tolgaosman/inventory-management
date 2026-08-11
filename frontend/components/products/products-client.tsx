"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useCurrency } from "@/lib/currency-context";
import { useSettings } from "@/lib/settings-context";
import { useAuth } from "@/lib/auth";
import { PRODUCT_STATUS_LABELS } from "@/lib/constants";
import { buildReportExcel } from "@/lib/export/excel";
import { buildReportPdf } from "@/lib/export/pdf";
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
} from "lucide-react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { PageHeader } from "@/components/common/page-header";
import { Can } from "@/components/common/can";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { useAsync } from "@/lib/hooks/use-async";
import { useChangedSince } from "@/lib/hooks/use-reset-on-change";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  type ProductRow,
  type ProductQuery,
} from "@/lib/api/products";
import { listCategories, listWarehouses, listSuppliers } from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/client";
import { formatCurrency, formatNumber } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/constants";
import { downloadBlob, reportFilename } from "@/lib/export/download";

import { COMPANY_NAME, type ReportData } from "@/lib/export/report-data";
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
  const { company } = useSettings();
  const { name } = useAuth();

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [search, setSearch] = useState(searchInput);
  const [categoryId, setCategoryId] = useState(searchParams.get("categoryId") ?? "all");
  const [stockStatus, setStockStatus] = useState(searchParams.get("stockStatus") ?? "all");
  const [warehouseId, setWarehouseId] = useState(searchParams.get("warehouseId") ?? "all");
  const [supplierId, setSupplierId] = useState(searchParams.get("supplierId") ?? "all");
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | undefined>(undefined);
  const [deleting, setDeleting] = useState<ProductRow | undefined>(undefined);
  const exportGuard = useSubmitGuard();

  // Debounce free-text search input.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const query: ProductQuery = useMemo(
    () => ({
      search: search || undefined,
      categoryId: categoryId === "all" ? undefined : categoryId,
      stockStatus: stockStatus === "all" ? undefined : (stockStatus as "kritik" | "dusuk" | "normal"),
      warehouseId: warehouseId === "all" ? undefined : warehouseId,
      supplierId: supplierId === "all" ? undefined : supplierId,
      page,
      pageSize: PAGE_SIZE,
      sortBy: sorting[0]?.id,
      sortDir: sorting[0]?.desc ? "desc" : "asc",
    }),
    [search, categoryId, stockStatus, warehouseId, supplierId, page, sorting],
  );

  // Reset to page 1 whenever a filter (anything but page itself) changes.
  const filterKey = JSON.stringify({ search, categoryId, stockStatus, warehouseId, supplierId, sorting });
  if (useChangedSince(filterKey) && page !== 1) setPage(1);

  // Keep the URL in sync so links like /urunler?stockStatus=kritik round-trip.
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (categoryId !== "all") params.set("categoryId", categoryId);
    if (stockStatus !== "all") params.set("stockStatus", stockStatus);
    if (warehouseId !== "all") params.set("warehouseId", warehouseId);
    if (supplierId !== "all") params.set("supplierId", supplierId);
    const qs = params.toString();
    router.replace(qs ? `/urunler?${qs}` : "/urunler", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryId, stockStatus, warehouseId, supplierId]);

  const { status, data, staleData, error, refetch } = useAsync(() => listProducts(query), [
    JSON.stringify(query),
  ]);
  const view = data ?? staleData;

  const { data: refData } = useAsync(
    () => Promise.all([listCategories(), listWarehouses(), listSuppliers({ pageSize: 1000 })]),
    [],
  );
  const categories = (refData?.[0] ?? []).filter((c) => c.parentId !== null);
  const warehouses = refData?.[1] ?? [];
  const suppliers = refData?.[2]?.rows ?? [];

  const isFiltered = Boolean(search || categoryId !== "all" || stockStatus !== "all" || warehouseId !== "all" || supplierId !== "all");

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setCategoryId("all");
    setStockStatus("all");
    setWarehouseId("all");
    setSupplierId("all");
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

  async function handleToggleStatus(row: ProductRow) {
    try {
      await toggleProductStatus(row.id);
      toast.success(row.status === "aktif" ? "Ürün pasife alındı." : "Ürün aktife alındı.");
      refetch();
    } catch (err) {
      toast.error("Durum güncellenemedi", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
    }
  }

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

  async function handleExportFormat(format: "excel" | "pdf") {
    await exportGuard.guard(async () => {
      try {
        const all = await listProducts({ ...query, page: 1, pageSize: 10000 });
        
          const report: ReportData = {
            company: company.companyName,
            title: "Ürün Yönetimi",
            generatedAt: new Date(),
            rangeLabel: "Tüm Zamanlar",
            generatedBy: name,
            currency: currency,
            kpis: [],
            sections: [
              {
                title: "Ürün Yönetimi",
                columns: ["Ürün Adı", "SKU", "Barkod", "Kategori", "Marka", "Birim", `Alış Fiyatı (${currency.toUpperCase()})`, `Satış Fiyatı (${currency.toUpperCase()})`, "Mevcut Stok", "Durum"],
                numericColumns: [6, 7, 8],
                currencyColumns: [6, 7],
                emptyMessage: "Ürün bulunamadı.",
                rows: all.rows.map((p) => [
                  p.name, p.sku, p.barcode, p.categoryName, p.brand, p.unit,
                  p.purchasePrice / (rates?.[currency] || 1), p.salePrice / (rates?.[currency] || 1), p.totalStock, PRODUCT_STATUS_LABELS[p.status]
                ])
              }
            ]
          };

          const ext = format === "excel" ? "xlsx" : "pdf";
          const filename = reportFilename(ext).replace("stok-raporu", "urun-yonetimi");
          
          if (format === "excel") {
             downloadBlob(buildReportExcel(report, ["all"]), filename);
             toast.success("Excel Raporu İndirildi 📊", { description: "Ürün listesi Excel (.xlsx) olarak kaydedildi." });
          } else {
             downloadBlob(await buildReportPdf(report, ["all"]), filename);
             toast.success("PDF Raporu İndirildi 📄", { description: "Ürün listesi PDF olarak kaydedildi." });
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
        id: "name",
        accessorKey: "name",
        header: "Ürün",
        meta: { className: "min-w-[220px]" },
        cell: ({ row }) => (
          <Link href={`/urunler/${row.original.id}`} className="block hover:text-primary">
            <span className="font-medium text-foreground">{row.original.name}</span>
            <span className="block text-xs text-muted-foreground">{row.original.brand}</span>
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
            <p className="font-mono text-[11px] text-muted-foreground">{row.original.barcode}</p>
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
            <p className="text-xs text-muted-foreground">
              min {row.original.minStock} / maks {row.original.maxStock}
            </p>
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
              <span className="font-medium text-foreground">{formatCurrency(row.original.salePrice, currency, rate)}</span>
              <p className="text-xs text-muted-foreground">Alış {formatCurrency(row.original.purchasePrice, currency, rate)}</p>
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
                  Detay
                </DropdownMenuItem>
                <Can permission="products.manage">
                  <>
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
    [currency, rates],
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

      <div
        className={cn(
          "grid grid-cols-2 gap-4 lg:grid-cols-4",
          status === "loading" ? "opacity-60 transition-opacity" : "transition-opacity",
        )}
      >
        <Card className="shadow-soft border-border/70 py-5 gap-2">
          <CardContent className="px-5">
            <KpiTile icon={Package} tint="blue" label="Toplam Ürün" value={formatNumber(view?.stats.total ?? 0)} />
          </CardContent>
        </Card>
        <Card className="shadow-soft border-border/70 py-5 gap-2">
          <CardContent className="px-5">
            <KpiTile icon={AlertTriangle} tint="red" label="Kritik Stok" value={formatNumber(view?.stats.critical ?? 0)} />
          </CardContent>
        </Card>
        <Card className="shadow-soft border-border/70 py-5 gap-2">
          <CardContent className="px-5">
            <KpiTile icon={CircleDot} tint="amber" label="Pasif Ürün" value={formatNumber(view?.stats.passive ?? 0)} />
          </CardContent>
        </Card>
        <Card className="shadow-soft border-border/70 py-5 gap-2">
          <CardContent className="px-5">
            <KpiTile icon={Wallet} tint="green" label="Stok Değeri" value={formatCurrency(view?.stats.stockValue ?? 0, currency, rates?.[currency] || 1)} />
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft border-border/70 py-5 gap-3">
        <CardContent className="space-y-3 px-5">
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

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
          </div>
        </CardContent>
      </Card>

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

      <ProductFormSheet open={formOpen} onOpenChange={setFormOpen} product={editing} onSaved={handleSaved} categories={categories} suppliers={suppliers} />

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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
