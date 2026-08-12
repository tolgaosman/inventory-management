"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx-js-style";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bulkImportProducts, type ProductInput } from "@/lib/api/products";
import { downloadBlob } from "@/lib/export/download";
import { formatCurrency } from "@/lib/format";
import type { Category, Supplier, Product } from "@/lib/types";

interface ParsedImportRow {
  name: string;
  sku: string;
  barcode: string;
  categoryName: string;
  categoryId: string;
  brand: string;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  minStock: number;
  maxStock: number;
  supplierName: string;
  supplierId: string;
  isValid: boolean;
  errorReason?: string;
}

interface ProductImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  categories: Category[];
  suppliers: Supplier[];
  existingProducts: Product[];
}

export function ProductImportModal({
  open,
  onOpenChange,
  onSuccess,
  categories,
  suppliers,
  existingProducts,
}: ProductImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Download Sample Excel Template
  function handleDownloadTemplate() {
    const headers = [
      "Ürün Adı",
      "SKU",
      "Barkod",
      "Kategori",
      "Marka",
      "Birim",
      "Alış Fiyatı",
      "Satış Fiyatı",
      "Minimum Stok",
      "Maksimum Stok",
      "Tedarikçi",
    ];

    const sampleRows = [
      [
        "Dell PowerEdge R750 Sunucu",
        "SRV-R750-01",
        "869000000101",
        categories[0]?.name || "Sunucu & Veri Merkezi",
        "Dell",
        "adet",
        45000,
        58000,
        2,
        10,
        suppliers[0]?.name || "TeknoDağıtım A.Ş.",
      ],
      [
        "Cisco Catalyst 9300 Switch",
        "SW-C9300-24T",
        "869000000102",
        categories[1]?.name || "Ağ & Siber Güvenlik",
        "Cisco",
        "adet",
        28000,
        36000,
        3,
        15,
        suppliers[1]?.name || "SiberAğ Sistemleri",
      ],
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

    // Set column widths
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 15) }));

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, "Urun_Yukleme_Sablonu.xlsx");
    toast.success("Örnek şablon indirildi.", {
      description: "Şablonu doldurup sisteme yükleyebilirsiniz.",
    });
  }

  // Parse Uploaded Excel/CSV File
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsParsing(true);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];

      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      if (rawRows.length === 0) {
        toast.error("Dosya boş", { description: "Yüklediğiniz Excel dosyasında hiç veri bulunamadı." });
        setParsedRows([]);
        setIsParsing(false);
        return;
      }

      const existingSkus = new Set(existingProducts.map((p) => p.sku.toLowerCase()));
      const seenFileSkus = new Set<string>();

      const rows: ParsedImportRow[] = rawRows.map((r) => {
        // Flexible key finder
        const findVal = (...keys: string[]) => {
          for (const key of keys) {
            for (const rKey of Object.keys(r)) {
              if (rKey.trim().toLowerCase() === key.toLowerCase()) {
                return String(r[rKey] ?? "").trim();
              }
            }
          }
          return "";
        };

        const name = findVal("Ürün Adı", "Ürün", "Ad", "Name");
        const sku = findVal("SKU", "Kod", "Stok Kodu");
        const barcode = findVal("Barkod", "Barcode");
        const catName = findVal("Kategori", "Category");
        const brand = findVal("Marka", "Brand") || "Genel";
        const unit = findVal("Birim", "Unit") || "adet";
        const purchasePrice = Number(findVal("Alış Fiyatı", "Alış", "Purchase Price")) || 0;
        const salePrice = Number(findVal("Satış Fiyatı", "Satış", "Sale Price")) || 0;
        const minStock = Number(findVal("Minimum Stok", "Min Stok", "Min")) || 5;
        const maxStock = Number(findVal("Maksimum Stok", "Maks Stok", "Max")) || 50;
        const suppName = findVal("Tedarikçi", "Supplier");

        // Category resolution
        let matchedCat = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
        if (!matchedCat && categories.length > 0) matchedCat = categories[0];

        // Supplier resolution
        let matchedSupp = suppliers.find((s) => s.name.toLowerCase() === suppName.toLowerCase());
        if (!matchedSupp && suppliers.length > 0) matchedSupp = suppliers[0];

        // Validation
        let isValid = true;
        let errorReason: string | undefined = undefined;

        if (!name) {
          isValid = false;
          errorReason = "Ürün adı boş olamaz.";
        } else if (!sku) {
          isValid = false;
          errorReason = "SKU boş olamaz.";
        } else if (existingSkus.has(sku.toLowerCase())) {
          isValid = false;
          errorReason = "Sistemde bu SKU zaten var.";
        } else if (seenFileSkus.has(sku.toLowerCase())) {
          isValid = false;
          errorReason = "Dosya içinde mükerrer SKU.";
        }

        if (sku) seenFileSkus.add(sku.toLowerCase());

        return {
          name,
          sku,
          barcode: barcode || String(Math.floor(100000000000 + Math.random() * 900000000000)),
          categoryName: matchedCat?.name || catName || "-",
          categoryId: matchedCat?.id || categories[0]?.id || "",
          brand,
          unit,
          purchasePrice,
          salePrice,
          minStock,
          maxStock,
          supplierName: matchedSupp?.name || suppName || "-",
          supplierId: matchedSupp?.id || suppliers[0]?.id || "",
          isValid,
          errorReason,
        };
      });

      setParsedRows(rows);
    } catch {
      toast.error("Dosya okunamadı", {
        description: "Lütfen geçerli bir Excel (.xlsx / .xls) dosyası yüklediğinizden emin olun.",
      });
    } finally {
      setIsParsing(false);
    }
  }

  // Handle Import Submit
  async function handleImportSubmit() {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error("İçe aktarılacak geçerli ürün yok", {
        description: "Lütfen hatalı SKU ve ürün adı bilgilerini düzeltip tekrar deneyin.",
      });
      return;
    }

    setIsImporting(true);
    try {
      const inputs: ProductInput[] = validRows.map((r) => ({
        name: r.name,
        sku: r.sku,
        barcode: r.barcode,
        categoryId: r.categoryId,
        brand: r.brand,
        unit: r.unit,
        purchasePrice: r.purchasePrice,
        salePrice: r.salePrice,
        minStock: r.minStock,
        maxStock: r.maxStock,
        supplierId: r.supplierId,
      }));

      const res = await bulkImportProducts(inputs);
      toast.success(`${res.importedCount} ürün başarıyla aktarıldı!`, {
        description: res.errors.length > 0 ? `${res.errors.length} ürün uyarı nedeniyle atlandı.` : undefined,
      });

      resetState();
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error("Aktarım sırasında hata oluştu");
    } finally {
      setIsImporting(false);
    }
  }

  function resetState() {
    setFileName(null);
    setParsedRows([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <FileSpreadsheet className="size-5 text-status-good" />
            Excel&apos;den Toplu Ürün Yükleme
          </DialogTitle>
          <DialogDescription className="text-xs">
            Şablon formatındaki Excel dosyanızı yükleyerek ürünlerinizi tek seferde sisteme ekleyebilirsiniz.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {/* Top Info & Template Link */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-status-good bg-status-good/10 text-xs">
            <div className="flex items-start gap-2.5">
              <FileText className="size-4 text-status-good shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Excel Şablon Formatı</p>
                <p className="text-muted-foreground">
                  Hızlı yükleme yapmak için önceden hazırlanmış örnek Excel şablonunu kullanabilirsiniz.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="gap-1.5 shrink-0 border-status-good text-status-good hover:bg-status-good/90 "
            >
              <Download className="size-3.5" />
              Örnek Şablon İndir (.xlsx)
            </Button>
          </div>

          {/* Upload Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl hover:border-status-good hover:bg-muted/30 transition-all cursor-pointer text-center"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="size-10 rounded-full bg-status-good/10 flex items-center justify-center text-status-good mb-2 transition-transform">
              <Upload className="size-5" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {fileName ? fileName : "Dosya Seçin veya Sürükleyip Bırakın"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Desteklenen formatlar: <span className="font-medium text-foreground">.xlsx, .xls, .csv</span>
            </p>
          </div>

          {/* Parsed Results Preview */}
          {isParsing && (
            <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
              <Loader2 className="size-4 animate-spin text-status-good" />
              Excel verileri okunuyor ve doğrulanıyor...
            </div>
          )}

          {!isParsing && parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-foreground">Önizleme ({parsedRows.length} Ürün)</span>
                  <Badge variant="outline" className="bg-status-good/10 text-status-good border-status-good">
                    {validCount} Geçerli
                  </Badge>
                  {invalidCount > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="size-3" />
                      {invalidCount} Hatalı / Atlanacak
                    </Badge>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetState}
                  className="size-7 p-0 text-muted-foreground hover:text-foreground"
                  title="Temizle"
                >
                  <RefreshCw className="size-3.5" />
                </Button>
              </div>

              <div className="max-h-60 overflow-y-auto rounded-lg border border-border bg-card">
                <Table className="text-xs">
                  <TableHeader className="bg-muted/50 sticky top-0">
                    <TableRow>
                      <TableHead className="h-8">Durum</TableHead>
                      <TableHead className="h-8">Ürün Adı</TableHead>
                      <TableHead className="h-8">SKU</TableHead>
                      <TableHead className="h-8">Kategori</TableHead>
                      <TableHead className="h-8 text-right">Alış</TableHead>
                      <TableHead className="h-8 text-right">Satış</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row, idx) => (
                      <TableRow key={idx} className={!row.isValid ? "bg-status-critical/10 " : undefined}>
                        <TableCell className="py-2">
                          {row.isValid ? (
                            <Badge variant="outline" className="bg-status-good/10 text-status-good border-status-good text-micro py-0">
                              <CheckCircle2 className="size-3 mr-1 text-status-good" />
                              Geçerli
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-micro py-0" title={row.errorReason}>
                              <X className="size-3 mr-1" />
                              {row.errorReason}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-2 font-medium truncate max-w-40">{row.name || "-"}</TableCell>
                        <TableCell className="py-2 font-mono text-micro">{row.sku || "-"}</TableCell>
                        <TableCell className="py-2 truncate max-w-32">{row.categoryName}</TableCell>
                        <TableCell className="py-2 text-right">{formatCurrency(row.purchasePrice)}</TableCell>
                        <TableCell className="py-2 text-right">{formatCurrency(row.salePrice)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-border bg-muted/20 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleImportSubmit}
            disabled={validCount === 0 || isImporting || isParsing}
            className="bg-status-good hover:bg-status-good/90 text-white gap-1.5"
          >
            {isImporting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Aktarılıyor...
              </>
            ) : (
              <>
                <Upload className="size-3.5" />
                {validCount > 0 ? `${validCount} Ürünü İçe Aktar` : "İçe Aktar"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
