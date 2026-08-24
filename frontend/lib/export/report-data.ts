// Builds the full report payload shared by the CSV and PDF exporters.
//
// Deliberately does NOT reuse getDashboardData() for everything: that one
// truncates its lists (top 6 critical products, last 8 movements, …) for the
// on-screen cards, whereas an exported report is expected to contain the
// complete data set. It's still used for the KPI/monthlyFlow/categoryShares/
// warehouseTotals sections, which the server already returns un-truncated.
//
// This layer returns plain values only — no locale formatting. Each exporter
// decides how to render them (CSV wants raw numbers Excel can parse, the PDF
// wants tr-TR formatted strings).
import { formatDateShort, formatDateTime } from "@/lib/format";
import { getDashboardData, MONTHS_BY_RANGE, RANGE_LABELS, type DateRangePreset } from "@/lib/api/dashboard";
import {
  criticalProducts as computeCriticalProducts,
  fetchReportDataset,
  fetchReportMovements,
  topMoversFromMovements,
} from "@/lib/reports/dataset";
import {
  MOVEMENT_REASON_LABELS,
  MOVEMENT_TYPE_LABELS,
  PRODUCT_STATUS_LABELS,
  PURCHASE_STATUS_LABELS,
} from "@/lib/constants";
import type { CurrencyCode } from "@/lib/currency-context";

export const COMPANY_NAME = "Near East Technology";
export const REPORT_TITLE = "Stok & Envanter Raporu";

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  try: "₺",
  usd: "$",
  eur: "€",
  gbp: "£",
};

/**
 * Both exporters filter `ReportData.sections` down to a user-picked subset by
 * matching this id against each section's Turkish `title` (there is no
 * dedicated id field on sections). Shared here so csv/excel/pdf agree on the
 * same rules instead of drifting.
 */
export function matchSectionId(title: string, id: string): boolean {
  const t = title.toLocaleLowerCase("tr-TR");
  switch (id) {
    case "kpi":
      return t.includes("özet") || t.includes("kpi");
    case "critical":
      return t.includes("kritik");
    case "movements":
      return t.includes("hareketleri") || (t.includes("hareket") && !t.includes("gören"));
    case "warehouse":
      return t.includes("depo");
    case "top_movers":
      return t.includes("en çok") || t.includes("gören");
    case "products":
      return t.includes("ürün");
    case "suppliers":
      return t.includes("tedarikçi");
    case "orders":
      return t.includes("sipariş") || t.includes("satın alma");
    case "monthly":
      return t.includes("aylık");
    case "categories":
      return t.includes("kategori");
    default:
      return false;
  }
}

/** A table that both exporters can render generically. */
export interface ReportSection {
  /** Section heading, e.g. "Kritik Stok". */
  title: string;
  columns: string[];
  rows: (string | number)[][];
  /** Indices of columns holding numbers — right-aligned in the PDF. */
  numericColumns: number[];
  /** Indices of columns holding a currency amount already converted to `ReportData.currency`. */
  currencyColumns?: number[];
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
  /** The currency KPI/section values below have already been converted into. */
  currency: CurrencyCode;
  kpis: ReportKpi[];
  sections: ReportSection[];
}

function rangeStart(range: DateRangePreset): Date {
  const start = new Date();
  start.setMonth(start.getMonth() - MONTHS_BY_RANGE[range]);
  start.setHours(0, 0, 0, 0);
  return start;
}

export async function buildReportData(
  range: DateRangePreset,
  generatedBy: string,
  currency: CurrencyCode = "try",
  rate: number = 1,
  companyName: string = COMPANY_NAME,
): Promise<ReportData> {
  const from = rangeStart(range).toISOString();
  const [dashboard, ds, movements] = await Promise.all([
    getDashboardData(range),
    fetchReportDataset(),
    fetchReportMovements(from),
  ]);

  const symbol = CURRENCY_SYMBOLS[currency];
  const convert = (v: number) => v / (rate || 1);

  const categoriesById = new Map(ds.categories.map((c) => [c.id, c]));
  const categoryName = (id: string) => categoriesById.get(id)?.name ?? "-";
  const warehousesById = new Map(ds.warehouses.map((w) => [w.id, w]));
  const usersById = new Map(ds.users.map((u) => [u.id, u]));

  // Server-computed and already un-truncated: KPIs, monthly flow (max(months,5)
  // months, unscoped), category shares (unscoped), warehouse totals (all).
  const kpis = dashboard.kpis;
  const monthlyFlow = dashboard.monthlyFlow;
  const categoryShares = dashboard.categoryShares;
  const categoryUnitTotal = categoryShares.reduce((sum, c) => sum + c.units, 0) || 1;
  const warehouseTotals = dashboard.warehouseTotals;

  // Every critical product, not just the six the dashboard card shows.
  const criticalProducts = computeCriticalProducts(ds)
    .map((p) => ({ product: p, current: p.totalStock, shortfall: Math.max(p.minStock - p.totalStock, 0) }))
    .sort((a, b) => b.shortfall - a.shortfall);

  // All movements inside the selected period (dashboard shows only 8) — the
  // server already filtered by `from` via fetchReportMovements(from); just order.
  const sortedMovements = [...movements].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

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
        categoryName(product.categoryId ?? ""),
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
      rows: topMoversFromMovements(movements, ds.products, 15).map((t) => [t.name, t.sku, t.movementCount, t.totalQuantity]),
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
      rows: sortedMovements.map((m) => {
        const product = ds.products.find((p) => p.id === m.productId);
        return [
          formatDateTime(m.createdAt),
          MOVEMENT_TYPE_LABELS[m.type],
          product?.name ?? "-",
          product?.sku ?? "-",
          warehousesById.get(m.warehouseId)?.name ?? "-",
          m.type === "transfer" ? (warehousesById.get(m.targetWarehouseId ?? "")?.name ?? "-") : "-",
          m.type === "cikis" || m.type === "transfer" ? -m.quantity : m.quantity,
          m.previousQuantity,
          m.newQuantity,
          MOVEMENT_REASON_LABELS[m.reason],
          usersById.get(m.userId)?.name ?? "-",
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
        "Son Satın Alış Fiyatı",
        "Min",
        "Maks",
        "Toplam Stok",
        "Durum",
        "Tedarikçi",
      ],
      numericColumns: [6, 7, 8, 9],
      currencyColumns: [6],
      emptyMessage: "Katalogda ürün yok.",
      rows: ds.products.map((p) => [
        p.name,
        p.sku,
        p.barcode,
        p.categoryName,
        p.brand,
        p.unit,
        p.purchasePrice != null ? convert(p.purchasePrice) : "-",
        p.minStock,
        p.maxStock,
        p.totalStock,
        PRODUCT_STATUS_LABELS[p.status],
        ds.suppliers.find((s) => s.id === p.supplierId)?.name ?? "-",
      ]),
    },
    {
      title: "Depolar",
      columns: ["Depo", "Şehir", "Adres", "Kapasite", "Mevcut Birim", "Ürün Çeşidi"],
      numericColumns: [3, 4, 5],
      emptyMessage: "Depo kaydı yok.",
      rows: ds.warehouses.map((w) => [w.name, w.city, w.address, w.capacity, w.units, w.productCount]),
    },
    {
      title: "Kategoriler",
      columns: ["Kategori", "Üst Kategori", "Ürün Sayısı"],
      numericColumns: [2],
      emptyMessage: "Kategori kaydı yok.",
      rows: ds.categories.map((c) => [
        c.name,
        c.parentId ? categoryName(c.parentId) : "-",
        ds.products.filter((p) => p.categoryId === c.id).length,
      ]),
    },
    {
      title: "Tedarikçiler",
      columns: ["Tedarikçi", "İlgili Kişi", "E-posta", "Telefon", "Şehir", "Ürün Sayısı"],
      numericColumns: [5],
      emptyMessage: "Tedarikçi kaydı yok.",
      rows: ds.suppliers.map((s) => [s.name, s.contactName, s.emails.join(", "), s.phone, s.city, s.productCount]),
    },
    {
      title: "Satın Alma Siparişleri",
      columns: [
        "Sipariş No",
        "Tedarikçi",
        "Durum",
        "Kalem",
        `Toplam (${symbol})`,
        "Sipariş Tarihi",
        "Beklenen Teslim",
      ],
      numericColumns: [3, 4],
      currencyColumns: [4],
      emptyMessage: "Satın alma siparişi yok.",
      rows: ds.orders.map((po) => [
        po.code,
        po.supplierName,
        PURCHASE_STATUS_LABELS[po.status],
        po.itemCount,
        convert(po.total),
        formatDateShort(po.createdAt),
        formatDateShort(po.expectedAt),
      ]),
    },
  ];

  return {
    company: companyName,
    title: REPORT_TITLE,
    generatedAt: new Date(),
    rangeLabel: RANGE_LABELS[range],
    generatedBy,
    currency,
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
      { label: "Satın Alma Tutarı", value: convert(kpis.purchaseTotalValue), currency: true, accent: "good" },
      { label: "İptal Sipariş", value: kpis.cancelledOrders },
      { label: "Toplam Tedarikçi", value: kpis.totalSuppliers },
      { label: "Toplam Kullanıcı", value: kpis.totalUsers },
      { label: "Kategori", value: kpis.categoryCount },
      { label: "Ürün Çeşidi", value: kpis.productVariantCount },
    ],
    sections,
  };
}
