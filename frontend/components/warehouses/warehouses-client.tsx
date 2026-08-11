"use client";

import { useMemo, useState } from "react";
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
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  RefreshCw,
  Boxes,
} from "lucide-react";
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
import type { Warehouse } from "@/lib/types";

export function WarehousesClient() {
  const { currency, rates } = useCurrency();
  const { name, role } = useAuth();

  // State
  const [search, setSearch] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");

  // Modals state
  const [detailProduct, setDetailProduct] = useState<ProductStockMatrixRow | null>(null);
  const [transferProduct, setTransferProduct] = useState<ProductStockMatrixRow | null>(null);
  const [sourceWarehouseId, setSourceWarehouseId] = useState<string>("");
  const [targetWarehouseId, setTargetWarehouseId] = useState<string>("");
  const [transferQuantity, setTransferQuantity] = useState<number>(1);
  const [transferNote, setTransferNote] = useState<string>("");

  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [whName, setWhName] = useState("");
  const [whCity, setWhCity] = useState("");
  const [whAddress, setWhAddress] = useState("");
  const [whCapacity, setWhCapacity] = useState<number>(10000);

  // Guards
  const transferGuard = useSubmitGuard();
  const warehouseFormGuard = useSubmitGuard();
  const deleteGuard = useSubmitGuard();

  // Data fetching
  const { status: whStatus, data: warehouses, refetch: refetchWarehouses } = useAsync(
    listWarehousesDetailed,
    [],
  );

  const { status: matrixStatus, data: matrix, refetch: refetchMatrix } = useAsync(
    () =>
      getProductStockMatrix({
        search,
        warehouseId: selectedWarehouseId,
        categoryId: selectedCategoryId,
      }),
    [search, selectedWarehouseId, selectedCategoryId],
  );

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

        toast.success("Stok Transferi Başarıyla Gerçekleşti 🚚", {
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

  // Open Add/Edit Warehouse Modal
  const openWarehouseModal = (wh?: Warehouse) => {
    if (wh) {
      setEditingWarehouse(wh);
      setWhName(wh.name);
      setWhCity(wh.city);
      setWhAddress(wh.address);
      setWhCapacity(wh.capacity);
    } else {
      setEditingWarehouse(null);
      setWhName("");
      setWhCity("");
      setWhAddress("");
      setWhCapacity(10000);
    }
    setIsWarehouseModalOpen(true);
  };

  // Save Warehouse Form
  const handleSaveWarehouse = async () => {
    if (!whName.trim() || !whCity.trim()) {
      toast.error("Lütfen depo adı ve şehir alanlarını doldurunuz.");
      return;
    }

    await warehouseFormGuard.guard(async () => {
      try {
        if (editingWarehouse) {
          await updateWarehouseInput(editingWarehouse.id, {
            name: whName,
            city: whCity,
            address: whAddress,
            capacity: whCapacity,
          });
          toast.success("Depo Bilgileri Güncellendi 🏢");
        } else {
          await createWarehouseInput({
            name: whName,
            city: whCity,
            address: whAddress,
            capacity: whCapacity,
          });
          toast.success("Yeni Depo Oluşturuldu 🏢");
        }
        setIsWarehouseModalOpen(false);
        refetchWarehouses();
        refetchMatrix();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "İşlem sırasında hata oluştu.");
      }
    });
  };

  // Delete Warehouse
  const handleDeleteWarehouse = async (id: string, name: string) => {
    if (!confirm(`"${name}" deposunu silmek istediğinize emin misiniz?`)) return;

    await deleteGuard.guard(async () => {
      try {
        await deleteWarehouseInput(id);
        toast.success("Depo Silindi 🗑️");
        refetchWarehouses();
        refetchMatrix();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Depo silinemedi.");
      }
    });
  };

  // Export Excel / PDF
  const handleExport = async (type: "excel" | "pdf") => {
    const report = buildReportData("bu-yil", `${name} (${role})`, currency, rates?.[currency]);
    const date = new Date();
    if (type === "excel") {
      downloadBlob(buildReportExcel(report, ["all"]), reportFilename("xlsx", date, "depo-envanter-raporu"));
      toast.success("Excel Raporu İndirildi 📊");
    } else {
      downloadBlob(await buildReportPdf(report, ["all"]), reportFilename("pdf", date, "depo-envanter-raporu"));
      toast.success("PDF Raporu İndirildi 📄");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Depo Yönetimi & Stok Matrisi"
        description="Şirketinizin tüm lokasyonlardaki depolarını ve ürünlerin depo bazlı stok dağılımlarını canlı yönetin."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>
              <Download className="mr-1.5 size-4 text-emerald-600" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
              <Download className="mr-1.5 size-4 text-rose-600" />
              PDF
            </Button>
            <Can permission="products.manage">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" onClick={() => openWarehouseModal()}>
                <Plus className="mr-1.5 size-4" />
                Yeni Depo Ekle
              </Button>
            </Can>
          </div>
        }
      />

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          icon={WarehouseIcon}
          tint="indigo"
          label="Toplam Depo Sayısı"
          value={formatNumber(summaryMetrics.totalCount)}
        />
        <KpiTile
          icon={Package}
          tint="blue"
          label="Toplanan Stok Adedi"
          value={`${formatNumber(summaryMetrics.totalUnits)} Adet`}
        />
        <KpiTile
          icon={Boxes}
          tint="teal"
          label="Depolardaki Envanter Değeri"
          value={formatCurrency(summaryMetrics.totalValue, currency, rates?.[currency] || 1)}
        />
        <KpiTile
          icon={Layers}
          tint="violet"
          label="Ortalama Doluluk Oranı"
          value={`% ${summaryMetrics.avgCapacity}`}
        />
      </div>

      {/* Warehouses Card Overview Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            Aktif Depo Lokasyonları
          </h2>
          <span className="text-xs text-muted-foreground font-medium">
            Filtrelemek için depoya tıklayabilirsiniz
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {warehouses?.map((wh) => {
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
                      <Badge variant="outline" className="mb-1 text-[10px] uppercase font-bold text-primary bg-primary/10 border-primary/20">
                        <MapPin className="mr-1 inline-block size-3" />
                        {wh.city}
                      </Badge>
                      <CardTitle className="text-sm font-bold tracking-tight line-clamp-1">
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
                          <DropdownMenuItem onClick={() => openWarehouseModal(wh)}>
                            <Pencil className="mr-2 size-3.5" /> Düzenle
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDeleteWarehouse(wh.id, wh.name)}
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
                    <span className="text-foreground font-bold">{formatNumber(wh.units)} Adet</span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Ürün Çeşidi:</span>
                    <span className="text-foreground">{wh.productCount} SKU</span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Toplam Değer:</span>
                    <span className="text-primary font-bold">
                      {formatCurrency(wh.totalValue, currency, rates?.[currency] || 1)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 pt-1 border-t border-border/40">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Doluluk:</span>
                      <span className="font-bold text-foreground">
                        %{wh.capacityUsagePercent} ({formatNumber(wh.units)} / {formatNumber(wh.capacity)})
                      </span>
                    </div>
                    <Progress
                      value={wh.capacityUsagePercent}
                      className="h-1.5"
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Main Stock Breakdown Matrix Section */}
      <Card className="border-border/70 shadow-soft">
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
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
                <SelectTrigger className="w-full sm:w-52 text-[11px] sm:text-xs h-9 whitespace-nowrap">
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
                <SelectTrigger className="w-full sm:w-52 text-[11px] sm:text-xs h-9 whitespace-nowrap">
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

        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-muted-foreground uppercase text-[11px] font-semibold border-y border-border/60">
              <tr>
                <th className="py-3 px-4 min-w-[220px]">Ürün &amp; Kod (SKU)</th>
                <th className="py-3 px-3">Kategori</th>
                {warehouses?.map((w) => (
                  <th key={w.id} className="py-3 px-3 text-center min-w-[110px]">
                    <div className="font-bold text-foreground">{w.city}</div>
                    <div className="text-[10px] text-muted-foreground font-normal line-clamp-1">{w.name}</div>
                  </th>
                ))}
                <th className="py-3 px-3 text-right">Toplam Stok</th>
                <th className="py-3 px-3 text-right">Stok Değeri</th>
                <th className="py-3 px-4 text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {matrixStatus === "loading" ? (
                <tr>
                  <td colSpan={5 + (warehouses?.length || 0)} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="size-5 animate-spin inline-block mr-2" />
                    Depo matris verileri yükleniyor...
                  </td>
                </tr>
              ) : matrix && matrix.length > 0 ? (
                matrix.map((row) => (
                  <tr key={row.productId} className="hover:bg-muted/30 transition-colors">
                    {/* Product & SKU */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground text-xs leading-tight">
                        {row.productName}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-[10px] text-muted-foreground">{row.sku}</span>
                        <span className="text-[10px] text-muted-foreground">({row.brand})</span>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                      {row.categoryName}
                    </td>

                    {/* Warehouse Individual Stocks */}
                    {warehouses?.map((w) => {
                      const qty = row.stocksByWarehouse[w.id] ?? 0;
                      return (
                        <td key={w.id} className="py-3 px-3 text-center">
                          {qty > 0 ? (
                            <Badge
                              variant="outline"
                              className="font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 px-2.5 py-0.5 text-xs select-none pointer-events-none"
                            >
                              {qty} Adet
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/40 font-mono text-[11px]">-</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Total Stock */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="font-bold text-foreground text-xs">
                        {row.totalStock} Adet
                      </div>
                      {row.isCritical && (
                        <Badge variant="destructive" className="mt-0.5 text-[9px] px-1 py-0 h-4">
                          <AlertTriangle className="mr-0.5 size-2.5" /> Kritik ({row.minStock})
                        </Badge>
                      )}
                    </td>

                    {/* Total Value */}
                    <td className="py-3 px-3 text-right font-semibold text-foreground whitespace-nowrap">
                      {formatCurrency(row.totalValue, currency, rates?.[currency] || 1)}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <Can permission="products.manage">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => openTransferModal(row)}
                          >
                            <ArrowLeftRight className="mr-1 size-3.5 text-indigo-500" /> Transfer
                          </Button>
                        </Can>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5 + (warehouses?.length || 0)} className="py-12 text-center text-muted-foreground">
                    Arama kriterlerinize uygun stok kaydı bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Product Warehouse Breakdown Detail Modal */}
      <Dialog open={!!detailProduct} onOpenChange={(open) => !open && setDetailProduct(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Package className="size-4 text-primary" />
              Depo Stok Dağılım Detayı
            </DialogTitle>
            <DialogDescription className="text-xs">
              {detailProduct?.productName} ({detailProduct?.sku})
            </DialogDescription>
          </DialogHeader>

          {detailProduct && (
            <div className="space-y-4 py-2">
              {/* Product Info Bar */}
              <div className="p-3 bg-muted/40 rounded-lg border border-border/60 flex items-center justify-between text-xs">
                <div>
                  <div className="text-muted-foreground">Birim Fiyat:</div>
                  <div className="font-bold text-foreground">
                    {formatCurrency(detailProduct.unitPrice, currency, rates?.[currency] || 1)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Toplam Stok:</div>
                  <div className="font-bold text-primary">
                    {detailProduct.totalStock} Adet
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Toplam Değer:</div>
                  <div className="font-bold text-foreground">
                    {formatCurrency(detailProduct.totalValue, currency, rates?.[currency] || 1)}
                  </div>
                </div>
              </div>

              {/* Per Warehouse List */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Depo Lokasyon Dağılımı
                </h4>

                {warehouses?.map((w) => {
                  const qty = detailProduct.stocksByWarehouse[w.id] ?? 0;
                  const percentage = detailProduct.totalStock > 0 ? Math.round((qty / detailProduct.totalStock) * 100) : 0;

                  return (
                    <div
                      key={w.id}
                      className="p-3 rounded-lg border border-border/60 bg-card hover:bg-muted/30 transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <MapPin className="size-3 text-primary" />
                          {w.name}
                          <span className="text-[10px] text-muted-foreground font-normal">({w.city})</span>
                        </div>
                        <div className="font-bold text-foreground">
                          {qty} Adet <span className="text-muted-foreground font-normal text-[11px]">(%{percentage})</span>
                        </div>
                      </div>

                      <Progress value={percentage} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (detailProduct) openTransferModal(detailProduct);
                setDetailProduct(null);
              }}
            >
              <ArrowLeftRight className="mr-1.5 size-3.5 text-indigo-500" />
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <ArrowLeftRight className="size-4 text-indigo-500" />
              Depolar Arası Stok Transferi
            </DialogTitle>
            <DialogDescription className="text-xs">
              {transferProduct?.productName} ürünü için depo stok transfer kaydı oluşturun.
            </DialogDescription>
          </DialogHeader>

          {transferProduct && (
            <div className="space-y-4 py-2 text-xs">
              {/* Source Warehouse */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Kaynak Depo (Çıkış Yapılacak):</Label>
                <Select value={sourceWarehouseId} onValueChange={(val) => setSourceWarehouseId(val || "")}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue>
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

              {/* Target Warehouse */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Hedef Depo (Giriş Yapılacak):</Label>
                <Select value={targetWarehouseId} onValueChange={(val) => setTargetWarehouseId(val || "")}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue>
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

              {/* Quantity */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label className="text-xs font-semibold">Transfer Miktarı (Adet):</Label>
                  <span className="text-[11px] text-muted-foreground">
                    Max: {transferProduct.stocksByWarehouse[sourceWarehouseId] ?? 0} Adet
                  </span>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={transferProduct.stocksByWarehouse[sourceWarehouseId] ?? 1}
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-9 text-xs"
                />
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Açıklama / Not (Opsiyonel):</Label>
                <Textarea
                  placeholder="Transfer nedeni veya irsaliye no yazabilirsiniz..."
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="text-xs min-h-[60px]"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTransferProduct(null)}>
              İptal
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              disabled={transferGuard.pending}
              onClick={handleExecuteTransfer}
            >
              {transferGuard.pending ? "Transfer Ediliyor..." : "Transferi Onayla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warehouse Add / Edit Form Modal */}
      <Dialog open={isWarehouseModalOpen} onOpenChange={setIsWarehouseModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Building2 className="size-4 text-primary" />
              {editingWarehouse ? "Depo Bilgilerini Düzenle" : "Yeni Depo Tanımla"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Depo adı, lokasyonu, adresi ve m³ hacim kapasitesini belirleyin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Depo Adı:</Label>
              <Input
                placeholder="Örn: Girne İnovasyon Deposu"
                value={whName}
                onChange={(e) => setWhName(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Şehir / Lokasyon:</Label>
              <Input
                placeholder="Örn: Lefkoşa, Girne, İstanbul..."
                value={whCity}
                onChange={(e) => setWhCity(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Açık Adres:</Label>
              <Textarea
                placeholder="Sanayi bölgesi, cadde, sokak detayları..."
                value={whAddress}
                onChange={(e) => setWhAddress(e.target.value)}
                className="text-xs min-h-[60px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Depo Kapasitesi (Adet / Hacim):</Label>
              <Input
                type="number"
                min={100}
                value={whCapacity}
                onChange={(e) => setWhCapacity(parseInt(e.target.value) || 1000)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsWarehouseModalOpen(false)}>
              İptal
            </Button>
            <Button
              size="sm"
              disabled={warehouseFormGuard.pending}
              onClick={handleSaveWarehouse}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {warehouseFormGuard.pending ? "Kaydediliyor..." : editingWarehouse ? "Değişiklikleri Kaydet" : "Depo Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
