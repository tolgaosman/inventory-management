"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useCurrency } from "@/lib/currency-context";
import { useSettings } from "@/lib/settings-context";
import { useAuth } from "@/lib/auth";
import { useAsync } from "@/lib/hooks/use-async";
import { useSubmitGuard } from "@/lib/hooks/use-submit-guard";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { Can } from "@/components/common/can";
import { StatGrid } from "@/components/common/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { capacityIndicatorClass } from "@/lib/capacity";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Warehouse as WarehouseIcon,
  Package,
  Plus,
  Search,
  ArrowLeftRight,
  MapPin,
  AlertTriangle,
  Layers,
  Download,
  Eye,
  MoreHorizontal,
  Pencil,
  Trash2,
  Building2,
  Boxes,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ProductImageThumbnail } from "@/components/common/product-image-thumbnail";
import {
  listWarehousesDetailed,
  getProductStockMatrix,
  createWarehouseInput,
  updateWarehouseInput,
  deleteWarehouseInput,
  type WarehouseDetail,
  type ProductStockMatrixRow,
} from "@/lib/api/warehouses";
import { createTransfer } from "@/lib/api/movements";
import { listCategories } from "@/lib/api/catalog";
import { buildReportExcel } from "@/lib/export/excel";
import { buildReportPdf } from "@/lib/export/pdf";
import { buildReportData } from "@/lib/export/report-data";
import { downloadBlob, reportFilename } from "@/lib/export/download";
import { WarehouseFormSheet } from "@/components/warehouses/warehouse-form-sheet";
import { ApiError } from "@/lib/api/client";
import type { Warehouse } from "@/lib/types";
import { PAGE_SIZE } from "@/lib/constants";

export function WarehousesClient() {
  const { currency, rates } = useCurrency();
  const { showKurus } = useSettings();
  const { name, role } = useAuth();

  // State
  const [search, setSearch] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [page, setPage] = useState(1);

  // Modals state
  const [detailProduct, setDetailProduct] = useState<ProductStockMatrixRow | null>(null);
  const [transferProduct, setTransferProduct] = useState<ProductStockMatrixRow | null>(null);
  const [sourceWarehouseId, setSourceWarehouseId] = useState<string>("");
  const [targetWarehouseId, setTargetWarehouseId] = useState<string>("");
  const [transferQuantity, setTransferQuantity] = useState<number>(1);
  const [transferNote, setTransferNote] = useState<string>("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | undefined>(undefined);
  const [deleting, setDeleting] = useState<WarehouseDetail | undefined>(undefined);

  // Guards
  const transferGuard = useSubmitGuard();
  const deleteGuard = useSubmitGuard();

  // Data fetching
  const { status: whStatus, data: warehouses, refetch: refetchWarehouses } = useAsync(
    listWarehousesDetailed,
    [],
  );

  const { status: matrixStatus, data: matrix, staleData: staleMatrix, refetch: refetchMatrix } = useAsync(
    () =>
      getProductStockMatrix({
        search,
        warehouseId: selectedWarehouseId,
        categoryId: selectedCategoryId,
      }),
    [search, selectedWarehouseId, selectedCategoryId],
  );

  const displayMatrix = matrix ?? staleMatrix;
  const isMatrixLoading = matrixStatus === "loading";

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, selectedWarehouseId, selectedCategoryId]);

  const totalMatrixItems = displayMatrix?.length || 0;
  const totalPages = Math.ceil(totalMatrixItems / PAGE_SIZE) || 1;
  const paginatedMatrix = useMemo(() => {
    if (!displayMatrix) return [];
    return displayMatrix.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [displayMatrix, page]);

  const { data: categories } = useAsync(listCategories, []);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    if (!warehouses) return { totalCount: 0, totalUnits: 0, totalValue: 0, avgCapacity: 0 };
    const totalCount = warehouses.length;
    const totalUnits = warehouses.reduce((sum, w) => sum + w.units, 0);
    const totalValue = warehouses.reduce((sum, w) => sum + w.totalValue, 0);
    const avgCapacity = totalCount > 0 ? Math.round(warehouses.reduce((sum, w) => sum + w.capacityUsagePercent, 0) / totalCount) : 0;
    return { totalCount, totalUnits, totalValue, avgCapacity };
  }, [warehouses]);

  // Open Transfer Modal
  const openTransferModal = (product: ProductStockMatrixRow, defaultSourceId?: string) => {
    if (product.status === "pasif") {
      toast.error("Transfer Yapılamaz", {
        description: `"${product.productName}" pasif durumda olduğu için stok transferi yapılamaz.`,
      });
      return;
    }
    setTransferProduct(product);
    setTransferQuantity(1);
    setTransferNote("");

    if (defaultSourceId) {
      setSourceWarehouseId(defaultSourceId);
      const otherWh = warehouses?.find((w) => w.id !== defaultSourceId);
      setTargetWarehouseId(otherWh?.id || "");
    } else {
      // Find first warehouse with stock > 0
      const sourceWhWithStock = warehouses?.find((w) => (product.stocksByWarehouse[w.id] ?? 0) > 0);
      const srcId = sourceWhWithStock?.id || warehouses?.[0]?.id || "";
      setSourceWarehouseId(srcId);
      const destId = warehouses?.find((w) => w.id !== srcId)?.id || "";
      setTargetWarehouseId(destId);
    }
  };

  // Execute Transfer
  const handleExecuteTransfer = async () => {
    if (!transferProduct || !sourceWarehouseId || !targetWarehouseId) return;
    if (sourceWarehouseId === targetWarehouseId) {
      toast.error("Kaynak ve hedef depo aynı olamaz.");
      return;
    }
    const availStock = transferProduct.stocksByWarehouse[sourceWarehouseId] ?? 0;
    if (transferQuantity <= 0 || transferQuantity > availStock) {
      toast.error(`Yetersiz stok: Kaynak depoda ${availStock} adet var.`);
      return;
    }

    await transferGuard.guard(async () => {
      try {
        await createTransfer({
          productId: transferProduct.productId,
          sourceWarehouseId,
          targetWarehouseId,
          quantity: transferQuantity,
          note: transferNote || `Depolar Arası Stok Transferi (${transferProduct.productName})`,
          userId: "u-1",
        });

        toast.success("Stok Transferi Başarıyla Gerçekleşti", {
          description: `${transferQuantity} adet ${transferProduct.productName} başarıyla taşındı.`,
        });

        setTransferProduct(null);
        refetchWarehouses();
        refetchMatrix();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Transfer hatası oluştu.");
      }
    });
  };

  // Open Add/Edit Warehouse Sheet
  const openCreate = () => {
    setEditingWarehouse(undefined);
    setFormOpen(true);
  };

  const openEdit = (wh: Warehouse) => {
    setEditingWarehouse(wh);
    setFormOpen(true);
  };

  // Save Warehouse Form
  async function handleSaved(values: Omit<Warehouse, "id">) {
    try {
      if (editingWarehouse) {
        await updateWarehouseInput(editingWarehouse.id, values);
      } else {
        await createWarehouseInput(values);
      }
      refetchWarehouses();
      refetchMatrix();
    } catch (err) {
      toast.error(editingWarehouse ? "Depo güncellenemedi" : "Depo oluşturulamadı", {
        description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
      });
      throw err;
    }
  }

  // Delete Warehouse
  async function handleDelete() {
    if (!deleting) return;
    await deleteGuard.guard(async () => {
      try {
        await deleteWarehouseInput(deleting.id);
        toast.success("Depo silindi.", { description: `${deleting.name} kaldırıldı.` });
        setDeleting(undefined);
        refetchWarehouses();
        refetchMatrix();
      } catch (err) {
        toast.error("Depo silinemedi", {
          description: err instanceof ApiError ? err.message : "Beklenmedik bir hata oluştu.",
        });
      }
    });
  }

  // Export Excel / PDF
  const handleExport = async (type: "excel" | "pdf") => {
    const report = buildReportData("bu-yil", `${name} (${role})`, currency, rates?.[currency]);
    const date = new Date();
    if (type === "excel") {
      downloadBlob(buildReportExcel(report, ["all"]), reportFilename("xlsx", date, "depo-envanter-raporu"));
      toast.success("Excel Raporu İndirildi");
    } else {
      downloadBlob(await buildReportPdf(report, ["all"]), reportFilename("pdf", date, "depo-envanter-raporu"));
      toast.success("PDF Raporu İndirildi");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Depo Yönetimi & Stok Matrisi"
        description="Şirketinizin tüm lokasyonlardaki depolarını ve ürünlerin depo bazlı stok dağılımlarını canlı yönetin."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm">
                    <Download className="mr-1.5 size-4" />
                    Dışa Aktar
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("excel")}>
                  <FileSpreadsheet className="mr-2 size-4 text-status-good" /> Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf")}>
                  <FileText className="mr-2 size-4 text-status-critical" /> PDF (.pdf)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Can permission="products.manage">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" onClick={openCreate}>
                <Plus className="mr-1.5 size-4" />
                Yeni Depo Ekle
              </Button>
            </Can>
          </>
        }
      />

      {/* KPI Cards */}
      <StatGrid
        className="grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        items={[
          {
            icon: WarehouseIcon,
            tint: "plum",
            label: "Toplam Depo Sayısı",
            value: formatNumber(summaryMetrics.totalCount),
          },
          {
            icon: Package,
            tint: "blue",
            label: "Toplanan Stok Adedi",
            value: `${formatNumber(summaryMetrics.totalUnits)} Adet`,
          },
          {
            icon: Boxes,
            tint: "teal",
            label: "Depolardaki Envanter Değeri",
            value: formatCurrency(summaryMetrics.totalValue, currency, rates?.[currency] || 1, showKurus),
          },
          {
            icon: Layers,
            tint: "amber",
            label: "Ortalama Doluluk Oranı",
            value: `% ${summaryMetrics.avgCapacity}`,
          },
        ]}
      />

      {/* Warehouses Card Overview Grid */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            Aktif Depo Lokasyonları
          </h2>
          <span className="text-xs text-muted-foreground font-medium">
            Filtrelemek için depoya tıklayabilirsiniz
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {whStatus === "loading" && !warehouses
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[168px] rounded-xl" />)
            : warehouses?.map((wh) => {
            const isSelected = selectedWarehouseId === wh.id;
            return (
              <Card
                key={wh.id}
                onClick={() => setSelectedWarehouseId(isSelected ? "all" : wh.id)}
                className={cn(
                  "cursor-pointer transition-all duration-200 hover:shadow-md border",
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                    : "border-border/70 hover:border-border bg-card",
                )}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <Badge variant="outline" className="mb-1 text-micro uppercase font-semibold text-primary bg-primary/10 border-primary/20">
                        <MapPin className="mr-1 inline-block size-3" />
                        {wh.city}
                      </Badge>
                      <CardTitle className="text-sm font-semibold tracking-tight line-clamp-1">
                        {wh.name}
                      </CardTitle>
                    </div>

                    <Can permission="products.manage">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon" className="size-7" onClick={(e) => e.stopPropagation()}>
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem render={<Link href={`/depolar/${wh.id}`} />}>
                            <Eye className="mr-2 size-3.5" /> Detay
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openEdit(wh)}>
                            <Pencil className="mr-2 size-3.5" /> Düzenle
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleting(wh)}
                          >
                            <Trash2 className="mr-2 size-3.5" /> Sil
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Can>
                  </div>
                  <CardDescription className="text-xs line-clamp-1 text-muted-foreground">
                    {wh.address}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 pt-2 space-y-3">
                  <div className="flex items-baseline justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Stok Miktarı:</span>
                    <span className="text-foreground font-semibold">{formatNumber(wh.units)} Adet</span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Ürün Çeşidi:</span>
                    <span className="text-foreground">{wh.productCount} SKU</span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Toplam Değer:</span>
                    <span className="text-primary font-semibold">
                      {formatCurrency(wh.totalValue, currency, rates?.[currency] || 1, showKurus)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 pt-1 border-t border-border/40">
                    <div className="flex justify-between text-micro">
                      <span className="text-muted-foreground">Doluluk:</span>
                      <span className="font-semibold text-foreground">
                        %{wh.capacityUsagePercent} ({formatNumber(wh.units)} / {formatNumber(wh.capacity)})
                      </span>
                    </div>
                    <Progress value={wh.capacityUsagePercent} className="h-1.5">
                      <ProgressTrack className="h-1.5">
                        <ProgressIndicator className={capacityIndicatorClass(wh.capacityUsagePercent)} />
                      </ProgressTrack>
                    </Progress>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Main Stock Breakdown Matrix Section */}
      <Card className="pb-0">
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Boxes className="size-4 text-primary" />
                Ürün Bazlı Depo Stok Dağılım Matrisi
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Her ürünün depo lokasyonlarındaki mevcut stok miktarları ve toplam envanter analizi
              </CardDescription>
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Ürün adı, SKU veya marka ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 text-xs h-9"
                />
              </div>

              <Select value={selectedWarehouseId} onValueChange={(val) => setSelectedWarehouseId(val || "all")}>
                <SelectTrigger className="w-full sm:w-fit sm:min-w-[180px] sm:max-w-[320px] text-micro sm:text-xs h-9">
                  <SelectValue>
                    {selectedWarehouseId === "all"
                      ? "Tüm Depolar"
                      : warehouses?.find((w) => w.id === selectedWarehouseId)?.name || "Depo Seçiniz"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Depolar</SelectItem>
                  {warehouses?.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedCategoryId} onValueChange={(val) => setSelectedCategoryId(val || "all")}>
                <SelectTrigger className="w-full sm:w-fit sm:min-w-[180px] sm:max-w-[320px] text-micro sm:text-xs h-9">
                  <SelectValue>
                    {selectedCategoryId === "all"
                      ? "Tüm Kategoriler"
                      : categories?.find((c) => c.id === selectedCategoryId)?.name || "Kategori Seçiniz"}
                  </SelectValue>
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
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/*
            Warehouse columns are dynamic, so this can't be a TanStack DataTable
            — but it can still use the shared Table primitives, which is where
            the header treatment, cell padding and hover state come from.

            table-fixed + explicit % widths (summing to 100) keep the matrix
            inside the card at any warehouse count, instead of the old
            sum-of-min-widths approach which forced horizontal scroll on
            anything narrower than ~1240px. The warehouse columns split the
            leftover percentage evenly, so adding a 6th warehouse shrinks
            every column instead of widening the table.
          */}
          <Table className="table-fixed w-full text-xs">
            <TableHeader>
              <TableRow className="border-y border-border/60 bg-muted/40 hover:bg-muted/40">
                <TableHead style={{ width: "22%" }} className="text-left">Ürün &amp; Kod (SKU)</TableHead>
                <TableHead style={{ width: "7%" }} className="text-center">Kategori</TableHead>
                {warehouses?.map((w) => {
                  const isSelected = selectedWarehouseId === w.id;
                  return (
                    <TableHead
                      key={w.id}
                      style={{ width: `${42 / Math.max(warehouses.length, 1)}%` }}
                      title={w.name}
                      className={cn(
                        "text-center transition-colors",
                        isSelected && "border-x border-primary/20 bg-primary/10 text-primary",
                      )}
                    >
                      <div className="truncate">{w.city}</div>
                    </TableHead>
                  );
                })}
                <TableHead style={{ width: "10%" }} className="text-center">Toplam Stok</TableHead>
                <TableHead style={{ width: "10%" }} className="text-center">Stok Değeri</TableHead>
                <TableHead style={{ width: "9%" }} className="pr-5 text-center">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody
              className={cn(
                "transition-opacity duration-200",
                isMatrixLoading && "pointer-events-none opacity-50",
              )}
            >
              {isMatrixLoading && !displayMatrix ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-border/40 hover:bg-transparent">
                    <TableCell>
                      <Skeleton className="mb-1 h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="mx-auto h-4 w-20" />
                    </TableCell>
                    {warehouses?.map((w) => (
                      <TableCell key={w.id} className="text-center">
                        <Skeleton className="mx-auto h-5 w-14" />
                      </TableCell>
                    ))}
                    <TableCell className="text-center">
                      <Skeleton className="mx-auto h-4 w-16" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="mx-auto h-4 w-20" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="mx-auto h-7 w-16" />
                    </TableCell>
                  </TableRow>
                ))
              ) : paginatedMatrix && paginatedMatrix.length > 0 ? (
                paginatedMatrix.map((row) => (
                  <TableRow key={row.productId} className="border-b border-border/40 transition-colors hover:bg-muted/50">
                    {/* Product & SKU */}
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <ProductImageThumbnail src={row.imageUrl} alt={row.productName} size="xs" />
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold leading-tight text-foreground" title={row.productName}>
                            {row.productName}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 overflow-hidden">
                            <span className="shrink-0 font-mono text-micro text-muted-foreground">{row.sku}</span>
                            <span className="truncate text-micro text-muted-foreground">({row.brand})</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Category */}
                    <TableCell className="truncate text-muted-foreground text-center" title={row.categoryName}>
                      {row.categoryName}
                    </TableCell>

                    {/* Warehouse Individual Stocks */}
                    {warehouses?.map((w) => {
                      const qty = row.stocksByWarehouse[w.id] ?? 0;
                      const isSelected = selectedWarehouseId === w.id;
                      return (
                        <TableCell
                          key={w.id}
                          className={cn(
                            "text-center transition-colors",
                            isSelected && "border-x border-primary/10 bg-primary/5",
                          )}
                        >
                          {qty > 0 ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "pointer-events-none select-none border-status-good px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                                isSelected
                                  ? "border-primary/30 bg-primary/15 text-primary"
                                  : "bg-status-good/10 text-status-good",
                              )}
                            >
                              {qty}
                            </Badge>
                          ) : (
                            <span className="font-mono text-micro text-muted-foreground/40">-</span>
                          )}
                        </TableCell>
                      );
                    })}

                    {/* Total Stock */}
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="truncate text-xs font-semibold tabular-nums text-foreground">
                          {formatNumber(row.totalStock)}
                        </div>
                        {row.isCritical && (
                          <Badge
                            variant="destructive"
                            className="mt-0.5 inline-flex h-4 items-center justify-center px-1.5 py-0 text-micro"
                            title={`Minimum stok: ${row.minStock}`}
                          >
                            <AlertTriangle className="mr-0.5 size-2.5" /> Kritik
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Total Value */}
                    <TableCell className="truncate text-center font-semibold tabular-nums text-foreground">
                      {formatCurrency(row.totalValue, currency, rates?.[currency] || 1, showKurus)}
                    </TableCell>

                    {/* Action */}
                    <TableCell className="pr-5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Can permission="products.manage">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={row.status === "pasif"}
                            title={row.status === "pasif" ? "Pasif durumdaki ürünlerde stok transferi yapılamaz." : "Stok Transfer Et"}
                            onClick={() => openTransferModal(row)}
                          >
                            <ArrowLeftRight className="mr-1 size-3.5 text-primary" /> Transfer
                          </Button>
                        </Can>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5 + (warehouses?.length || 0)} className="py-12 text-center text-muted-foreground">
                    Arama kriterlerinize uygun stok kaydı bulunamadı.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {!isMatrixLoading && totalMatrixItems > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">
                {formatNumber((page - 1) * PAGE_SIZE + 1)}–{formatNumber(Math.min(page * PAGE_SIZE, totalMatrixItems))}
              </span>{" "}
              / {formatNumber(totalMatrixItems)} kayıt · Sayfa {page} / {totalPages}
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="size-4" />
                Önceki
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Sonraki Sayfa
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Product Warehouse Breakdown Detail Modal */}
      <Dialog open={!!detailProduct} onOpenChange={(open) => !open && setDetailProduct(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Package className="size-4 text-primary" />
              {detailProduct?.productName}
            </DialogTitle>
            <DialogDescription className="text-xs">
              SKU: {detailProduct?.sku} · Kategori: {detailProduct?.categoryName} · Marka: {detailProduct?.brand}
            </DialogDescription>
          </DialogHeader>

          {detailProduct && (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-3 gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
                <div>
                  <p className="text-muted-foreground">Toplam Stok</p>
                  <p className="text-sm font-semibold text-foreground">{formatNumber(detailProduct.totalStock)} Birim</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Birim Fiyat</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(detailProduct.unitPrice, currency, rates?.[currency] || 1, showKurus)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Toplam Değer</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(detailProduct.totalValue, currency, rates?.[currency] || 1, showKurus)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-foreground">Depo Bazında Stok Dağılımı</p>
                <div className="divide-y divide-border/40 rounded-lg border border-border/60">
                  {warehouses?.map((w) => {
                    const qty = detailProduct.stocksByWarehouse[w.id] ?? 0;
                    return (
                      <div key={w.id} className="flex items-center justify-between px-3 py-2">
                        <span className="font-medium text-foreground">{w.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn("font-mono font-semibold", qty > 0 ? "text-foreground" : "text-muted-foreground")}>
                            {formatNumber(qty)} Birim
                          </span>
                          {qty > 0 && (
                            <Can permission="products.manage">
                              <Button
                                variant="ghost"
                                size="xs"
                                disabled={detailProduct.status === "pasif"}
                                title={detailProduct.status === "pasif" ? "Pasif durumdaki ürünlerde stok transferi yapılamaz." : undefined}
                                onClick={() => {
                                  openTransferModal(detailProduct, w.id);
                                  setDetailProduct(null);
                                }}
                                className="h-6 px-1.5 text-micro text-primary hover:text-primary hover:bg-primary/10 disabled:opacity-50"
                              >
                                Transfer Et
                              </Button>
                            </Can>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              disabled={detailProduct?.status === "pasif"}
              title={detailProduct?.status === "pasif" ? "Pasif durumdaki ürünlerde stok transferi yapılamaz." : undefined}
              onClick={() => {
                if (detailProduct) openTransferModal(detailProduct);
                setDetailProduct(null);
              }}
            >
              <ArrowLeftRight className="mr-1.5 size-3.5 text-primary" />
              Stok Transfer Et
            </Button>
            <Button size="sm" onClick={() => setDetailProduct(null)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Transfer Modal */}
      <Dialog open={!!transferProduct} onOpenChange={(open) => !open && setTransferProduct(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <ArrowLeftRight className="size-4 text-primary" />
              Depolar Arası Stok Transferi
            </DialogTitle>
            <DialogDescription className="text-xs">
              {transferProduct?.productName} ürünü için depo stok transfer kaydı oluşturun.
            </DialogDescription>
          </DialogHeader>

          {transferProduct && (
            <div className="space-y-4 py-2 text-xs">
              {/* Source & Target Warehouse */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs font-semibold text-foreground truncate block">Kaynak Depo (Çıkış Yapılacak):</Label>
                  <Select value={sourceWarehouseId} onValueChange={(val) => setSourceWarehouseId(val || "")}>
                    <SelectTrigger className="w-full h-9 text-micro sm:text-xs px-2.5 tracking-tight">
                      <SelectValue className="text-micro sm:text-xs">
                        {warehouses?.find((w) => w.id === sourceWarehouseId)?.name || "Kaynak Depo Seçin"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses?.map((w) => {
                        const avail = transferProduct.stocksByWarehouse[w.id] ?? 0;
                        return (
                          <SelectItem key={w.id} value={w.id} disabled={avail === 0}>
                            {w.name} — Mevcut Stok: {avail} Adet
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-center sm:pt-5">
                  <ArrowLeftRight className="size-4 shrink-0 text-primary" />
                </div>

                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs font-semibold text-foreground truncate block">Hedef Depo (Giriş Yapılacak):</Label>
                  <Select value={targetWarehouseId} onValueChange={(val) => setTargetWarehouseId(val || "")}>
                    <SelectTrigger className="w-full h-9 text-micro sm:text-xs px-2.5 tracking-tight">
                      <SelectValue className="text-micro sm:text-xs">
                        {warehouses?.find((w) => w.id === targetWarehouseId)?.name || "Hedef Depo Seçin"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses
                        ?.filter((w) => w.id !== sourceWarehouseId)
                        .map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name} — Mevcut Stok: {transferProduct.stocksByWarehouse[w.id] ?? 0} Adet
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Transfer Miktarı (Adet):</Label>
                  <span className="text-micro font-medium text-muted-foreground">
                    Max: {transferProduct.stocksByWarehouse[sourceWarehouseId] ?? 0} Adet
                  </span>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={transferProduct.stocksByWarehouse[sourceWarehouseId] ?? 1}
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-9 text-xs w-full"
                />
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Açıklama / Not (Opsiyonel):</Label>
                <Textarea
                  placeholder="Transfer nedeni veya irsaliye no yazabilirsiniz..."
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="text-xs min-h-[70px] w-full resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-3">
            <Button variant="outline" size="sm" className="h-9 px-4" onClick={() => setTransferProduct(null)}>
              İptal
            </Button>
            <Button
              size="sm"
              className="h-9 px-5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              disabled={transferGuard.pending}
              onClick={handleExecuteTransfer}
            >
              {transferGuard.pending ? "Transfer Ediliyor..." : "Transferi Onayla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WarehouseFormSheet open={formOpen} onOpenChange={setFormOpen} warehouse={editingWarehouse} onSaved={handleSaved} />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Depoyu sil</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `"${deleting.name}" kalıcı olarak silinecek. Bu işlem geri alınamaz. Depoda henüz stok varsa silme işlemi engellenecektir.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteGuard.pending}
              variant="destructive-solid"
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
