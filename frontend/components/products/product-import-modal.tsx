"use client";

import { useState, useRef } from "react";
// Plain (patched) SheetJS build, not xlsx-js-style — this file parses files a
// user uploads, and xlsx-js-style bundles the same unpatched CVE-affected
// parser xlsx used to. No cell styling is needed here (template writer only
// sets column widths), so the patched build is a drop-in replacement.
import * as XLSX from "xlsx";
// exceljs only builds the outbound template (never parses an uploaded file,
// so the CVE concern above doesn't apply to it) — it's the one of these three
// libraries that actually supports writing in-cell dropdown data validation,
// which the plain `xlsx` community build doesn't.
import ExcelJS from "exceljs";
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
  Trash2,
  FileType,
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
import { useSettings } from "@/lib/settings-context";
import { cn } from "@/lib/utils";
import type { Category, Supplier, Product } from "@/lib/types";

interface ParsedImportRow {
  name: string;
  sku: string;
  barcode: string;
  categoryName: string;
  categoryId: string;
  brand: string;
  unit: string;
  purchasePrice?: number;
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
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { showKurus } = useSettings();

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  async function handleDownloadTemplate() {
    const headers = [
      "Ürün Adı",
      "SKU",
      "Barkod",
      "Kategori",
      "Marka",
      "Birim (Adet/Lisans)",
      "Son Satın Alış Fiyatı",
      "Min Stok",
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
        "Adet",
        45000,
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
        "Adet",
        28000,
        3,
        15,
        suppliers[1]?.name || "SiberAğ Sistemleri",
      ],
    ];

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Ürünler");
    sheet.addRow(headers);
    sampleRows.forEach((row) => sheet.addRow(row));

    sheet.columns = headers.map((h) => {
      let width = Math.max(h.length + 4, 15);
      if (h === "Kategori") width = 45;
      if (h === "Tedarikçi") width = 45;
      if (h === "Ürün Adı") width = 45;
      if (h === "Marka") width = 30;
      if (h === "Son Satın Alış Fiyatı") width = 25;
      return { width };
    });

    // Style the header row
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F172A" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF334155" } },
        bottom: { style: "thin", color: { argb: "FF334155" } },
        left: { style: "thin", color: { argb: "FF334155" } },
        right: { style: "thin", color: { argb: "FF334155" } },
      };
    });

    // Center align all cells
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
    });

    // Category names live on a hidden sheet so the dropdown can reference a
    // cell range (a literal comma-joined list breaks on category names that
    // themselves contain a comma, and has a length limit besides).
    const categoryNames = categories.map((c) => c.name).filter(Boolean);
    if (categoryNames.length > 0) {
      const lookupSheet = workbook.addWorksheet("Kategoriler");
      categoryNames.forEach((name, i) => {
        lookupSheet.getCell(i + 1, 1).value = name;
      });
      lookupSheet.state = "hidden";

      const categoryColumn = headers.indexOf("Kategori") + 1; // 1-based
      const lastDataRow = 1000; // generous headroom past the 2 sample rows
      for (let row = 2; row <= lastDataRow; row++) {
        sheet.getCell(row, categoryColumn).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`Kategoriler!$A$1:$A$${categoryNames.length}`],
          showErrorMessage: true,
          errorStyle: "stop",
          errorTitle: "Geçersiz kategori",
          error: "Lütfen listeden bir kategori seçin.",
        };
      }
    }

    // Tedarikçi dropdown validation
    const supplierNames = suppliers.map((s) => s.name).filter(Boolean);
    if (supplierNames.length > 0) {
      const supplierSheet = workbook.addWorksheet("Tedarikciler");
      supplierNames.forEach((name, i) => {
        supplierSheet.getCell(i + 1, 1).value = name;
      });
      supplierSheet.state = "hidden";

      const supplierColumn = headers.indexOf("Tedarikçi") + 1;
      for (let row = 2; row <= 1000; row++) {
        sheet.getCell(row, supplierColumn).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`Tedarikciler!$A$1:$A$${supplierNames.length}`],
          showErrorMessage: true,
          errorStyle: "stop",
          errorTitle: "Geçersiz tedarikçi",
          error: "Lütfen listeden bir tedarikçi seçin.",
        };
      }
    }

    // Only two short, comma-free values — a literal inline list is fine here,
    // unlike Kategori's hidden-sheet range.
    const unitColumn = headers.indexOf("Birim (Adet/Lisans)") + 1;
    for (let row = 2; row <= 1000; row++) {
      sheet.getCell(row, unitColumn).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Adet,Lisans"'],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Geçersiz birim",
        error: 'Lütfen "Adet" veya "Lisans" seçin.',
      };
    }

    // Barkod values are long digit strings — format the column as a plain
    // integer so Excel's default "General" format doesn't switch a
    // manually-typed long number to scientific notation.
    sheet.getColumn(headers.indexOf("Barkod") + 1).numFmt = "0";

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, "Urun_Yukleme_Sablonu.xlsx");
    toast.success("Örnek şablon indirildi.", {
      description: "Şablonu doldurup sisteme yükleyebilirsiniz.",
    });
  }

  async function processFile(file: File) {
    setFileName(file.name);
    setFileSize(formatBytes(file.size));

    const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      toast.error("Dosya çok büyük", { description: "Lütfen 10MB'tan küçük bir dosya yükleyin." });
      setParsedRows([]);
      return;
    }

    setIsParsing(true);

    let rawRows: Record<string, unknown>[];
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];
      rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    } catch {
      toast.error("Dosya okunamadı", { description: "Dosya bozuk veya desteklenmeyen bir formatta olabilir." });
      setParsedRows([]);
      setIsParsing(false);
      return;
    }

    try {
      if (rawRows.length === 0) {
        toast.error("Dosya boş", { description: "Yüklediğiniz Excel dosyasında hiç veri bulunamadı." });
        setParsedRows([]);
        setIsParsing(false);
        return;
      }

      const existingSkus = new Set(existingProducts.map((p) => p.sku.toLowerCase()));
      const seenFileSkus = new Set<string>();

      const rows: ParsedImportRow[] = rawRows.map((r) => {
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
        const unit = findVal("Birim", "Unit") || "Adet";
        const rawPurchasePrice = findVal("Son Satın Alış Fiyatı", "Alış Fiyatı", "Alış", "Purchase Price");
        const purchasePrice = rawPurchasePrice ? Number(rawPurchasePrice) : undefined;
        const minStock = Number(findVal("Minimum Stok", "Min Stok", "Min")) || 5;
        const maxStock = Number(findVal("Maksimum Stok", "Maks Stok", "Max")) || 50;
        const suppName = findVal("Tedarikçi", "Supplier");

        let matchedCat = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
        if (!matchedCat && categories.length > 0) matchedCat = categories[0];

        let matchedSupp = suppliers.find((s) => s.name.toLowerCase() === suppName.toLowerCase());
        if (!matchedSupp && suppliers.length > 0) matchedSupp = suppliers[0];

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

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
        purchasePrice: r.purchasePrice ?? null,
        salePrice: null,
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
    setFileSize(null);
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
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden rounded-xl border border-border">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-tint-green/10 text-tint-green shrink-0">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground">
                Excel&apos;den Toplu Ürün Yükleme
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Şablon formatındaki Excel dosyanızı yükleyerek ürünlerinizi tek seferde sisteme ekleyebilirsiniz.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {/* Template Info Card */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-tint-green/20 bg-tint-green/5">
            <div className="flex items-start gap-3 min-w-0">
              <FileText className="size-4 text-tint-green shrink-0 mt-0.5" />
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-semibold text-foreground">Excel Şablon Formatı</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Hızlı yükleme yapmak için önceden hazırlanmış örnek Excel şablonunu kullanabilirsiniz.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="gap-1.5 shrink-0 border-tint-green/30 text-tint-green hover:bg-tint-green/10 text-xs h-8"
            >
              <Download className="size-3.5" />
              Şablon İndir (.xlsx)
            </Button>
          </div>

          {/* Upload Dropzone or Selected File Card */}
          {!fileName ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "group flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl transition-all cursor-pointer text-center",
                isDragging
                  ? "border-tint-green bg-tint-green/10"
                  : "border-border/80 hover:border-tint-green/60 hover:bg-muted/40"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="size-11 rounded-xl bg-tint-green/10 text-tint-green flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Upload className="size-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Dosya Seçin veya Sürükleyip Bırakın
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Desteklenen formatlar: <span className="font-medium text-foreground">.xlsx, .xls, .csv</span>
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-10 rounded-lg bg-tint-green/10 text-tint-green flex items-center justify-center shrink-0">
                  <FileType className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{fileName}</p>
                  <p className="text-micro text-muted-foreground mt-0.5">{fileSize} · Excel Dosyası</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 text-xs gap-1"
                >
                  <RefreshCw className="size-3" />
                  Değiştir
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetState}
                  className="h-8 size-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Dosyayı Kaldır"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Parsed Results Preview */}
          {isParsing && (
            <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2.5">
              <Loader2 className="size-4 animate-spin text-tint-green" />
              Excel verileri analiz ediliyor...
            </div>
          )}

          {!isParsing && parsedRows.length > 0 && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-foreground">Önizleme ({parsedRows.length} Satır)</span>
                  <Badge variant="outline" className="bg-tint-green/10 text-tint-green border-tint-green/30">
                    {validCount} Geçerli
                  </Badge>
                  {invalidCount > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="size-3" />
                      {invalidCount} Hatalı
                    </Badge>
                  )}
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-card">
                <Table className="text-xs">
                  <TableHeader className="bg-muted/60 sticky top-0">
                    <TableRow>
                      <TableHead className="h-8 font-semibold">Durum</TableHead>
                      <TableHead className="h-8 font-semibold">Ürün Adı</TableHead>
                      <TableHead className="h-8 font-semibold">SKU</TableHead>
                      <TableHead className="h-8 font-semibold">Kategori</TableHead>
                      <TableHead className="h-8 text-right font-semibold">Alış</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row, idx) => (
                      <TableRow key={idx} className={!row.isValid ? "bg-destructive/5" : undefined}>
                        <TableCell className="py-2">
                          {row.isValid ? (
                            <Badge variant="outline" className="bg-tint-green/10 text-tint-green border-tint-green/30 text-micro py-0">
                              <CheckCircle2 className="size-3 mr-1 text-tint-green" />
                              Geçerli
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-micro py-0" title={row.errorReason}>
                              <X className="size-3 mr-1" />
                              {row.errorReason}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-2 font-medium truncate max-w-40 text-foreground">{row.name || "-"}</TableCell>
                        <TableCell className="py-2 font-mono text-micro text-muted-foreground">{row.sku || "-"}</TableCell>
                        <TableCell className="py-2 truncate max-w-32 text-muted-foreground">{row.categoryName}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums text-foreground">
                          {row.purchasePrice != null ? formatCurrency(row.purchasePrice, "TRY", 1, showKurus) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="mx-0 mb-0 px-6 py-4 border-t border-border bg-card gap-3 sm:gap-3 justify-end items-center">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-9 px-4 text-xs">
            Vazgeç
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleImportSubmit}
            disabled={validCount === 0 || isImporting || isParsing}
            className="h-9 px-4 text-xs bg-tint-green text-white hover:bg-tint-green/90 font-medium gap-1.5 shadow-xs"
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
