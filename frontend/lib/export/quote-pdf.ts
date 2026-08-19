// Satın Alma Teklif Formu (RFQ) PDF — modeled directly on the company's paper
// template: logo + big title, a two-column meta block, a single priced item
// table (padded out with blank rows so it reads as a form, not a report), a
// subtotal/VAT/grand-total box, notes & terms, and two signature lines.
import type { RowInput } from "jspdf-autotable";
import { formatCurrency, formatDate, formatDateShort } from "@/lib/format";
import { CURRENCY_SYMBOLS } from "./report-data";
import {
  COLORS,
  MARGIN,
  FOOTER_HEIGHT,
  FONT,
  type Doc,
  createPdfDoc,
  drawFooter,
  loadBrandLogo,
} from "./pdf-theme";
import type { QuoteRequestDetail } from "@/lib/api/quotes";
import type { CompanySettings } from "@/lib/settings-context";

export interface QuoteRequestDocument {
  quote: QuoteRequestDetail;
  company: CompanySettings;
  language?: "tr" | "en";
  approverName?: string;
}

/** Not part of the schema yet — no product/order/supplier carries a tax rate today, so the template's fixed rate is used. Centralized here so a future `taxRate` field only needs to be wired in one place. */
const VAT_RATE = 0.2;

/** Blank rows appended to the item table so a short quote still fills a page like the paper form does. Only applied when everything already fits on one page. */
const MIN_TABLE_ROWS = 14;

const DICT = {
  tr: {
    headerTitle: "SATIN ALMA TEKLİF FORMU",
    quoteNoLabel: "Teklif No",
    supplierLabel: "Tedarikçi:",
    contactLabel: "İletişim:",
    preparedByLabel: "Hazırlayan:",
    orderNoLabel: "Sipariş No:",
    colNo: "No",
    colCode: "Ürün Kodu",
    colName: "Ürün Adı",
    colQty: "Miktar",
    colUnit: "Birim",
    colUnitPrice: "Birim Fiyat",
    colVat: "KDV",
    colLineTotal: "Toplam",
    subtotal: "ALT TOPLAM",
    vat: "KDV (%20)",
    grandTotal: "GENEL TOPLAM",
    notesTitle: "Notlar & Koşullar",
    vatExcluded: "Fiyatlara KDV dahil değildir.",
    deliveryLine: (address: string, date: string) => `Teslim adresi: ${address}. İstenen teslim tarihi: ${date}.`,
    termsLine: (terms: string, validUntil: string) =>
      `Ödeme şartı: ${terms || "-"}. Teklif geçerlilik tarihi: ${validUntil}.`,
    currencyLine: (code: string) => `Teklif para birimi: ${code}.`,
    signPrepared: "Hazırlayan İmza",
    signApproved: "Onaylayan İmza",
    footerLeft: "Teklif Formu",
  },
  en: {
    headerTitle: "PURCHASE QUOTE FORM",
    quoteNoLabel: "Quote No",
    supplierLabel: "Supplier:",
    contactLabel: "Contact:",
    preparedByLabel: "Prepared By:",
    orderNoLabel: "Order No:",
    colNo: "No",
    colCode: "Product Code",
    colName: "Product Name",
    colQty: "Qty",
    colUnit: "Unit",
    colUnitPrice: "Unit Price",
    colVat: "VAT",
    colLineTotal: "Total",
    subtotal: "SUBTOTAL",
    vat: "VAT (20%)",
    grandTotal: "GRAND TOTAL",
    notesTitle: "Notes & Terms",
    vatExcluded: "Prices are exclusive of VAT.",
    deliveryLine: (address: string, date: string) => `Delivery address: ${address}. Requested delivery date: ${date}.`,
    termsLine: (terms: string, validUntil: string) => `Payment terms: ${terms || "-"}. Quote valid until: ${validUntil}.`,
    currencyLine: (code: string) => `Requested quote currency: ${code}.`,
    signPrepared: "Prepared Signature",
    signApproved: "Approved Signature",
    footerLeft: "Quote Form",
  },
};

/** Truncates `text` with "…" so it fits `maxWidth` at the doc's current font — used for the manually-drawn meta block values. */
function ellipsizeText(doc: Doc, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  const ellipsis = "…";
  let truncated = text;
  while (truncated.length > 1 && doc.getTextWidth(truncated + ellipsis) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + ellipsis;
}

/** Logo + company name on the left, form title + quote no / date on the right. No rule beneath it — this is what previously collided with the header text. */
async function drawHeader(
  doc: Doc,
  quote: QuoteRequestDetail,
  company: CompanySettings,
  lang: "tr" | "en",
): Promise<number> {
  const t = DICT[lang];
  let y = MARGIN;

  const logo = await loadBrandLogo();
  if (logo) {
    const targetHeight = 26;
    const targetWidth = targetHeight * (logo.width / logo.height);
    doc.addImage(logo.dataUrl, "PNG", MARGIN, y, targetWidth, targetHeight);

    doc.setFont(FONT, "normal");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.ink);
    doc.text(company.companyName, MARGIN + targetWidth + 10, y + targetHeight / 2 + 4);
  } else {
    doc.setFont(FONT, "bold");
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.brandDark);
    doc.text(company.companyName, MARGIN, y + 18);
  }

  y += 26 + 22;

  doc.setFont(FONT, "bold");
  doc.setFontSize(20);
  doc.setTextColor(...COLORS.brandDark);
  doc.text(t.headerTitle, MARGIN, y);

  y += 16;

  doc.setFont(FONT, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.muted);
  doc.text(`${formatDate(quote.createdAt)}   ·   ${t.quoteNoLabel}: ${quote.code}`, MARGIN, y);

  return y + 20;
}

/** Two-column, two-row meta block: supplier / contact on the left, prepared-by / source order codes on the right. */
function drawMetaBlock(doc: Doc, quote: QuoteRequestDetail, y: number, lang: "tr" | "en"): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const t = DICT[lang];
  const leftX = MARGIN;
  const rightX = pageWidth / 2;
  const colWidth = pageWidth / 2 - MARGIN - 8;
  const rowHeight = 16;

  const rows: [string, string, string, string][] = [
    [t.orderNoLabel, quote.orders.map((o) => o.code).join(", "), "", ""],
    [t.supplierLabel, quote.supplier.name, "", ""],
    [t.contactLabel, [quote.supplier.email, quote.supplier.phone].filter(Boolean).join("  ·  ") || "-", "", ""],
  ];

  rows.forEach(([leftLabel, leftValue, rightLabel, rightValue], i) => {
    const rowY = y + i * rowHeight;

    doc.setFont(FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.secondary);
    doc.text(leftLabel, leftX, rowY);
    doc.text(rightLabel, rightX, rowY);

    const leftLabelWidth = doc.getTextWidth(leftLabel) + 5;
    const rightLabelWidth = doc.getTextWidth(rightLabel) + 5;

    doc.setFont(FONT, "normal");
    doc.setTextColor(...COLORS.ink);
    doc.text(ellipsizeText(doc, leftValue, colWidth - leftLabelWidth), leftX + leftLabelWidth, rowY);
    doc.text(ellipsizeText(doc, rightValue, colWidth - rightLabelWidth), rightX + rightLabelWidth, rowY);
  });

  return y + rows.length * rowHeight;
}

interface FlatItem {
  sku: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

/** Single priced item table across all source orders — row numbering runs continuously regardless of which order a line came from. Padded with blank rows up to MIN_TABLE_ROWS when everything fits on one page, matching the paper template's form look. */
function drawItemsTable(
  doc: Doc,
  items: FlatItem[],
  cursorY: number,
  autoTable: typeof import("jspdf-autotable").autoTable,
  lang: "tr" | "en",
  subtotal: number,
): number {
  const t = DICT[lang];
  const symbol = CURRENCY_SYMBOLS.try;

  const body: RowInput[] = items.map((item, i) => [
    String(i + 1),
    item.sku,
    item.name,
    String(item.quantity),
    item.unit,
    formatCurrency(item.unitPrice, "try"),
    "%20",
    formatCurrency(item.quantity * item.unitPrice, "try"),
  ]);

  const padCount = items.length < MIN_TABLE_ROWS ? MIN_TABLE_ROWS - items.length : 0;
  for (let i = 0; i < padCount; i++) {
    body.push(["", "", "", "", "", "", "", ""]);
  }

  const vat = subtotal * VAT_RATE;
  body.push([
    { content: `${t.subtotal} (${symbol})`, colSpan: 7, styles: { halign: "right" } },
    { content: formatCurrency(subtotal, "try"), styles: { halign: "right" } },
  ]);
  body.push([
    { content: `${t.vat} (${symbol})`, colSpan: 7, styles: { halign: "right" } },
    { content: formatCurrency(vat, "try"), styles: { halign: "right" } },
  ]);
  body.push([
    { content: `${t.grandTotal} (${symbol})`, colSpan: 7, styles: { halign: "right", fontStyle: "bold", fillColor: COLORS.brandDark, textColor: COLORS.white } },
    { content: formatCurrency(subtotal + vat, "try"), styles: { halign: "right", fontStyle: "bold", fillColor: COLORS.brandDark, textColor: COLORS.white } },
  ]);

  autoTable(doc, {
    startY: cursorY,
    head: [[t.colNo, t.colCode, t.colName, t.colQty, t.colUnit, `${t.colUnitPrice} (${symbol})`, t.colVat, `${t.colLineTotal} (${symbol})`]],
    body,
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN, top: MARGIN + 10, bottom: FOOTER_HEIGHT + 10 },
    columnStyles: {
      0: { cellWidth: 26, halign: "center", cellPadding: { top: 7, right: 2, bottom: 7, left: 2 } },
      1: { cellWidth: 90, halign: "left" },
      2: { cellWidth: "auto", halign: "left" },
      3: { cellWidth: 48, halign: "center" },
      4: { cellWidth: 42, halign: "center" },
      5: { cellWidth: 76, halign: "right" },
      6: { cellWidth: 52, halign: "center" },
      7: { cellWidth: 82, halign: "right" },
    },
    styles: {
      font: FONT,
      fontStyle: "normal",
      fontSize: 9,
      cellPadding: { top: 7, right: 6, bottom: 7, left: 6 },
      textColor: COLORS.ink,
      lineColor: COLORS.grid,
      lineWidth: 0.4,
      // Single-line cells — long product names get an ellipsis instead of
      // wrapping and cramping the row.
      overflow: "ellipsize",
      valign: "middle",
      minCellHeight: 22,
    },
    headStyles: {
      font: FONT,
      fontStyle: "bold",
      fillColor: COLORS.brandDark,
      textColor: COLORS.white,
      fontSize: 8.5,
      lineWidth: 0.4,
      overflow: "ellipsize",
      halign: "center",
      valign: "middle",
      minCellHeight: 24,
    },
  });

  return (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? cursorY;
}


/** Notes & terms on the left, two signature lines on the right — laid out side by side beneath the totals grid. */
function drawFooterBlock(doc: Doc, quote: QuoteRequestDetail, y: number, lang: "tr" | "en", approverName?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const t = DICT[lang];

  const lines = [
    t.vatExcluded,
    t.deliveryLine(quote.deliveryAddress, formatDateShort(quote.deliveryDate)),
    t.termsLine(quote.paymentTerms, formatDateShort(quote.validUntil)),
  ];
  if (quote.requestedCurrency !== "try") {
    lines.push(t.currencyLine(quote.requestedCurrency.toUpperCase()));
  }

  const notesWidth = pageWidth - MARGIN * 2 - 200;

  doc.setFont(FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.ink);
  doc.text(t.notesTitle, MARGIN, y);

  doc.setFont(FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.secondary);
  let notesY = y + 13;
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, notesWidth);
    doc.text(wrapped, MARGIN, notesY);
    notesY += wrapped.length * 10;
  }
  if (quote.notes) {
    const wrapped = doc.splitTextToSize(quote.notes, notesWidth);
    doc.text(wrapped, MARGIN, notesY);
  }

  const signWidth = 95;
  const rightX = pageWidth - MARGIN;
  const gap = 20;
  const sign2X = rightX - signWidth;
  const sign1X = sign2X - gap - signWidth;
  const lineY = y + 50;

  doc.setDrawColor(...COLORS.ink);
  doc.setLineWidth(0.6);
  doc.line(sign1X, lineY, sign1X + signWidth, lineY);
  doc.line(sign2X, lineY, sign2X + signWidth, lineY);

  doc.setFont(FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text(t.signPrepared, sign1X + signWidth / 2, lineY + 12, { align: "center" });
  if (quote.createdBy) {
    doc.text(quote.createdBy, sign1X + signWidth / 2, lineY + 22, { align: "center" });
  }

  doc.text(t.signApproved, sign2X + signWidth / 2, lineY + 12, { align: "center" });
  if (approverName) {
    doc.text(approverName, sign2X + signWidth / 2, lineY + 22, { align: "center" });
  }
}

export async function buildQuoteRequestPdf(input: QuoteRequestDocument): Promise<Blob> {
  const { doc, autoTable } = await createPdfDoc();
  const lang = input.language || "tr";
  const t = DICT[lang];

  doc.setProperties({
    title: `${input.company.companyName} — ${t.headerTitle} ${input.quote.code}`,
    subject: `${t.quoteNoLabel}: ${input.quote.code}`,
    author: input.quote.contactName,
    creator: input.company.companyName,
  });

  let cursorY = await drawHeader(doc, input.quote, input.company, lang);
  cursorY = drawMetaBlock(doc, input.quote, cursorY, lang);

  const flatItems: FlatItem[] = input.quote.orders.flatMap((order) =>
    order.items.map((item) => ({
      sku: item.product.sku,
      name: item.product.name,
      quantity: item.quantity,
      unit: item.product.unit,
      unitPrice: item.unitPrice,
    })),
  );
  const subtotal = flatItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  cursorY = drawItemsTable(doc, flatItems, cursorY, autoTable, lang, subtotal) + 30;

  const pageHeight = doc.internal.pageSize.getHeight();
  if (cursorY > pageHeight - FOOTER_HEIGHT - 90) {
    doc.addPage();
    cursorY = MARGIN + 20;
  }
  drawFooterBlock(doc, input.quote, cursorY, lang, input.approverName);

  const pageCount = doc.getNumberOfPages();
  const footerTitle = `${t.footerLeft} · ${input.quote.code}`;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(doc, footerTitle, i, pageCount);
  }

  return doc.output("blob");
}
