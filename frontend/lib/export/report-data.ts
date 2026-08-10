// Builds the full report payload shared by the CSV and PDF exporters.
//
// Deliberately does NOT reuse getDashboardData(): that one truncates its lists
// (top 6 critical products, last 8 movements, …) for the on-screen cards,
// whereas an exported report is expected to contain the complete data set.
//
// This layer returns plain values only — no locale formatting. Each exporter
// decides how to render them (CSV wants raw numbers Excel can parse, the PDF
// wants tr-TR formatted strings).
import {
  categories,
  products,
  purchaseOrderTotal,
  purchaseOrders,
  stockLevels,
  stockMovements,
  suppliers,
  totalStockForProduct,
  users,
  warehouses,
} from "@/lib/mock/data";
import { formatDateShort, formatDateTime } from "@/lib/format";
import {
  getCategoryShares,
  getDashboardKpis,
  getMonthlyFlow,
  getTopMovers,
  getWarehouseStockTotals,
  getCriticalProducts,
} from "@/lib/mock/dashboard";
import { MONTHS_BY_RANGE, RANGE_LABELS, type DateRangePreset } from "@/lib/api/dashboard";
import {
  MOVEMENT_REASON_LABELS,
  MOVEMENT_TYPE_LABELS,
  PRODUCT_STATUS_LABELS,
  PURCHASE_STATUS_LABELS,
} from "@/lib/constants";

export const COMPANY_NAME = "Near East Technology";
export const REPORT_TITLE = "Stok & Envanter Raporu";

/** A table that both exporters can render generically. */
export interface ReportSection {
  /** Section heading, e.g. "Kritik Stok". */
  title: string;
  columns: string[];
  rows: (string | number)[][];
  /** Indices of columns holding numbers — right-aligned in the PDF. */
  numericColumns: number[];
  /** Shown instead of the table when there are no rows. */
  emptyMessage: string;
}

export interface ReportKpi {
  label: string;
  value: number;
  /** Rendered as currency rather than a plain count. */
  currency?: boolean;
  accent?: "neutral" | "good" | "critical" | "in" | "out";
}

export interface ReportData {
  company: string;
  title: string;
  generatedAt: Date;
  rangeLabel: string;
  generatedBy: string;
  kpis: ReportKpi[];
  sections: ReportSection[];
}

function warehouseName(id: string | undefined): string {
  if (!id) return "-";
  return warehouses.find((w) => w.id === id)?.name ?? "-";
}

function categoryName(id: string): string {
  return categories.find((c) => c.id === id)?.name ?? "-";
}

function supplierName(id: string): string {
  return suppliers.find((s) => s.id === id)?.name ?? "-";
}

function userName(id: string): string {
  return users.find((u) => u.id === id)?.name ?? "-";
}

function rangeStart(range: DateRangePreset): Date {
  const start = new Date();
  start.setMonth(start.getMonth() - MONTHS_BY_RANGE[range]);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function buildReportData(range: DateRangePreset, generatedBy: string): ReportData {
  const kpis = getDashboardKpis();
  const from = rangeStart(range).toISOString();

  // 3 — Monthly inbound/outbound over the selected window.
  const monthlyFlow = getMonthlyFlow(Math.max(MONTHS_BY_RANGE[range], 5));

  // 4 — Category distribution, with each category's share of the total.
  const categoryShares = getCategoryShares();
  const categoryUnitTotal = categoryShares.reduce((sum, c) => sum + c.units, 0) || 1;

  // 5 — Stock per warehouse, with utilisation against capacity.
  const warehouseTotals = getWarehouseStockTotals();

  // 6 — Every critical product, not just the six the dashboard card shows.
  const criticalProducts = getCriticalProducts()
    .map((p) => {
      const current = totalStockForProduct(p.id);
      return { product: p, current, shortfall: Math.max(p.minStock - current, 0) };
    })
    .sort((a, b) => b.shortfall - a.shortfall);

  // 8 — All movements inside the selected period (dashboard shows only 8).
  const movements = stockMovements
    .filter((m) => m.createdAt >= from)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const sections: ReportSection[] = [
    {
      title: "Aylık Giriş / Çıkış",
      columns: ["Ay", "Giriş", "Çıkış", "Net"],
      numericColumns: [1, 2, 3],
      emptyMessage: "Seçilen dönemde hareket kaydı yok.",
      rows: monthlyFlow.map((m) => [m.month, m.inbound, m.outbound, m.inbound - m.outbound]),
    },
    {
      title: "Kategori Dağılımı",
      columns: ["Kategori", "Birim", "Pay (%)"],
      numericColumns: [1, 2],
      emptyMessage: "Kategori verisi yok.",
      rows: categoryShares.map((c) => [
        c.name,
        c.units,
        `% ${Math.round((c.units / categoryUnitTotal) * 100)}`,
      ]),
    },
    {
      title: "Depo Bazında Stok",
      columns: ["Depo", "Mevcut Birim", "Kapasite", "Doluluk (%)"],
      numericColumns: [1, 2, 3],
      emptyMessage: "Depo verisi yok.",
      rows: warehouseTotals.map((w) => [
        w.name,
        w.units,
        w.capacity,
        `% ${Math.round((w.units / w.capacity) * 100)}`,
      ]),
    },
    {
      title: "Kritik Stok",
      columns: ["Ürün", "SKU", "Kategori", "Marka", "Mevcut", "Minimum", "Açık"],
      numericColumns: [4, 5, 6],
      emptyMessage: "Kritik seviyede ürün yok.",
      rows: criticalProducts.map(({ product, current, shortfall }) => [
        product.name,
        product.sku,
        categoryName(product.categoryId),
        product.brand,
        current,
        product.minStock,
        shortfall,
      ]),
    },
    {
      title: "En Çok Hareket Gören Ürünler",
      columns: ["Ürün", "SKU", "Hareket Sayısı", "Toplam Miktar"],
      numericColumns: [2, 3],
      emptyMessage: "Hareket verisi yok.",
      rows: getTopMovers(15).map((t) => [t.name, t.sku, t.movementCount, t.totalQuantity]),
    },
    {
      title: "Stok Hareketleri",
      columns: [
        "Tarih",
        "Tip",
        "Ürün",
        "SKU",
        "Depo",
        "Hedef Depo",
        "Miktar",
        "Önceki",
        "Yeni",
        "Sebep",
        "Kullanıcı",
      ],
      numericColumns: [6, 7, 8],
      emptyMessage: "Seçilen dönemde stok hareketi yok.",
      rows: movements.map((m) => {
        const product = products.find((p) => p.id === m.productId);
        return [
          formatDateTime(m.createdAt),
          MOVEMENT_TYPE_LABELS[m.type],
          product?.name ?? "-",
          product?.sku ?? "-",
          warehouseName(m.warehouseId),
          m.type === "transfer" ? warehouseName(m.targetWarehouseId) : "-",
          m.type === "cikis" || m.type === "transfer" ? -m.quantity : m.quantity,
          m.previousQuantity,
          m.newQuantity,
          MOVEMENT_REASON_LABELS[m.reason],
          userName(m.userId),
        ];
      }),
    },
    {
      title: "Ürün Kataloğu",
      columns: [
        "Ürün",
        "SKU",
        "Barkod",
        "Kategori",
        "Marka",
        "Birim",
        "Alış (USD)",
        "Satış (USD)",
        "Min",
        "Maks",
        "Toplam Stok",
        "Durum",
        "Tedarikçi",
      ],
      numericColumns: [6, 7, 8, 9, 10],
      emptyMessage: "Katalogda ürün yok.",
      rows: products.map((p) => [
        p.name,
        p.sku,
        p.barcode,
        categoryName(p.categoryId),
        p.brand,
        p.unit,
        p.purchasePrice,
        p.salePrice,
        p.minStock,
        p.maxStock,
        totalStockForProduct(p.id),
        PRODUCT_STATUS_LABELS[p.status],
        supplierName(p.supplierId),
      ]),
    },
    {
      title: "Depolar",
      columns: ["Depo", "Şehir", "Adres", "Kapasite", "Mevcut Birim", "Ürün Çeşidi"],
      numericColumns: [3, 4, 5],
      emptyMessage: "Depo kaydı yok.",
      rows: warehouses.map((w) => [
        w.name,
        w.city,
        w.address,
        w.capacity,
        warehouseTotals.find((t) => t.warehouseId === w.id)?.units ?? 0,
        new Set(stockLevels.filter((s) => s.warehouseId === w.id).map((s) => s.productId)).size,
      ]),
    },
    {
      title: "Kategoriler",
      columns: ["Kategori", "Üst Kategori", "Ürün Sayısı"],
      numericColumns: [2],
      emptyMessage: "Kategori kaydı yok.",
      rows: categories.map((c) => [
        c.name,
        c.parentId ? categoryName(c.parentId) : "-",
        products.filter((p) => p.categoryId === c.id).length,
      ]),
    },
    {
      title: "Tedarikçiler",
      columns: ["Tedarikçi", "İlgili Kişi", "E-posta", "Telefon", "Şehir", "Ürün Sayısı"],
      numericColumns: [5],
      emptyMessage: "Tedarikçi kaydı yok.",
      rows: suppliers.map((s) => [
        s.name,
        s.contactName,
        s.email,
        s.phone,
        s.city,
        products.filter((p) => p.supplierId === s.id).length,
      ]),
    },
    {
      title: "Satın Alma Siparişleri",
      columns: [
        "Sipariş No",
        "Tedarikçi",
        "Durum",
        "Kalem",
        "Toplam (USD)",
        "Sipariş Tarihi",
        "Beklenen Teslim",
      ],
      numericColumns: [3, 4],
      emptyMessage: "Satın alma siparişi yok.",
      rows: purchaseOrders.map((po) => [
        po.code,
        supplierName(po.supplierId),
        PURCHASE_STATUS_LABELS[po.status],
        po.items.length,
        purchaseOrderTotal(po),
        formatDateShort(po.createdAt),
        formatDateShort(po.expectedAt),
      ]),
    },
  ];

  return {
    company: COMPANY_NAME,
    title: REPORT_TITLE,
    generatedAt: new Date(),
    rangeLabel: RANGE_LABELS[range],
    generatedBy,
    kpis: [
      { label: "Toplam Ürün", value: kpis.totalProducts },
      { label: "Toplam Depo", value: kpis.totalWarehouses },
      { label: "Kritik Stok", value: kpis.criticalStockCount, accent: "critical" },
      { label: "Bugünkü Giriş", value: kpis.todayIn, accent: "in" },
      { label: "Bugünkü Çıkış", value: kpis.todayOut, accent: "out" },
      { label: "Eldeki Miktar", value: kpis.onHandUnits },
      { label: "Yolda", value: kpis.incomingUnits },
      { label: "Açık Sipariş", value: kpis.openPurchaseOrders },
      { label: "Bekleyen Teslimat", value: kpis.pendingDeliveries },
      { label: "Satın Alma Tutarı", value: kpis.purchaseTotalValue, currency: true, accent: "good" },
      { label: "İptal Sipariş", value: kpis.cancelledOrders },
      { label: "Toplam Tedarikçi", value: kpis.totalSuppliers },
      { label: "Toplam Kullanıcı", value: kpis.totalUsers },
      { label: "Kategori", value: kpis.categoryCount },
      { label: "Ürün Çeşidi", value: kpis.productVariantCount },
    ],
    sections,
  };
}
