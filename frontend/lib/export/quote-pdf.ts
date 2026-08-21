// Satın Alma Teklif Formu (RFQ) PDF — modeled directly on the company's paper
// template: logo + big title, a two-column meta block, a single priced item
// table (padded out with blank rows so it reads as a form, not a report), a
// subtotal/VAT/grand-total box, notes & terms, and two signature lines.
import type { RowInput } from "jspdf-autotable";
import { formatDate, formatDateShort } from "@/lib/format";
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


/** Blank rows appended to the item table so a short quote still fills a page like the paper form does. Only applied when everything already fits on one page. */
const MIN_TABLE_ROWS = 14;

const DICT = {
  tr: {
    headerTitle: "SATIN ALMA TEKLİF FORMU",
    quoteNoLabel: "Teklif No",
    supplierLabel: "Tedarikçi:",
    contactLabel: "İletişim:",
    preparedByLabel: "Hazırlayan:",
    approvedByLabel: "Onaylayan:",
    colNo: "No",
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
    approvedByLabel: "Approved By:",
    colNo: "No",
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

/** Two-column meta block: supplier / contact on the left, prepared-by (+ approved-by, when different) on the right. */
function drawMetaBlock(doc: Doc, quote: QuoteRequestDetail, y: number, lang: "tr" | "en"): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const t = DICT[lang];
  const leftX = MARGIN;
  const rightX = pageWidth / 2;
  const colWidth = pageWidth / 2 - MARGIN - 8;
  const rowHeight = 16;

  const creatorName = quote.createdByUser?.name ?? quote.createdBy ?? "-";
  const creatorEmail = quote.createdByUser?.email ?? quote.contactEmail ?? "";
  const creatorPhone = quote.createdByUser?.phone ?? "";
  const creatorLine = [creatorName, creatorEmail, creatorPhone].filter(Boolean).join(" - ");

  const approverName = quote.approvedByUser?.name ?? quote.approvedBy ?? null;
  const approverEmail = quote.approvedByUser?.email ?? "";
  const approverPhone = quote.approvedByUser?.phone ?? "";
  const approverLine = approverName ? [approverName, approverEmail, approverPhone].filter(Boolean).join(" - ") : null;

  const supplierName = quote.supplier?.name ?? quote.adhocSupplierName ?? "-";
  const supplierContact = quote.supplier
    ? [quote.supplier.emails[0], quote.supplier.phone].filter(Boolean).join("  ·  ") || "-"
    : quote.adhocSupplierEmail || "-";

  const leftRows: [string, string][] = [
    [t.supplierLabel, supplierName],
    [t.contactLabel, supplierContact],
  ];

  const rightRows: [string, string][] = [
    [t.contactLabel, creatorLine],
  ];
  if (approverLine && approverLine !== creatorLine) {
    rightRows.push(["", approverLine]);
  }

  const rowCount = Math.max(leftRows.length, rightRows.length);

  function drawColumn(rows: [string, string][], colX: number) {
    doc.setFont(FONT, "bold");
    doc.setFontSize(9);
    const maxLabelWidth = Math.max(...rows.map(([label]) => doc.getTextWidth(label))) + 5;

    rows.forEach(([label, value], i) => {
      const rowY = y + i * rowHeight;

      doc.setFont(FONT, "bold");
      doc.setTextColor(...COLORS.secondary);
      doc.text(label, colX, rowY);

      doc.setFont(FONT, "normal");
      doc.setTextColor(...COLORS.ink);
      doc.text(ellipsizeText(doc, value, colWidth - maxLabelWidth), colX + maxLabelWidth, rowY);
    });
  }

  drawColumn(leftRows, leftX);
  drawColumn(rightRows, rightX);

  return y + rowCount * rowHeight;
}

interface FlatItem {
  name: string;
  quantity: number;
  unit: string;
}

/** Single item table across all requested lines — price columns left blank intentionally so the supplier fills them in. */
function drawItemsTable(
  doc: Doc,
  items: FlatItem[],
  cursorY: number,
  autoTable: typeof import("jspdf-autotable").autoTable,
  lang: "tr" | "en",
): number {
  const t = DICT[lang];

  const body: RowInput[] = items.map((item, i) => [
    String(i + 1),
    item.name,
    String(item.quantity),
    item.unit,
    "",   // Birim Fiyat — tedarikçi dolduracak
    "",   // Toplam — tedarikçi dolduracak
  ]);

  const padCount = items.length < MIN_TABLE_ROWS ? MIN_TABLE_ROWS - items.length : 0;
  for (let i = 0; i < padCount; i++) {
    body.push(["", "", "", "", "", ""]);
  }

  autoTable(doc, {
    startY: cursorY,
    head: [[t.colNo, t.colName, t.colQty, t.colUnit, t.colUnitPrice, t.colLineTotal]],
    body,
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN, top: MARGIN + 10, bottom: FOOTER_HEIGHT + 10 },
    columnStyles: {
      0: { cellWidth: 26, halign: "center", cellPadding: { top: 7, right: 2, bottom: 7, left: 2 } },
      1: { cellWidth: "auto", halign: "left" },
      2: { cellWidth: 48, halign: "center" },
      3: { cellWidth: 42, halign: "center" },
      4: { cellWidth: 90, halign: "right" },
      5: { cellWidth: 90, halign: "right" },
    },
    styles: {
      font: FONT,
      fontStyle: "normal",
      fontSize: 9,
      cellPadding: { top: 7, right: 6, bottom: 7, left: 6 },
      textColor: COLORS.ink,
      lineColor: COLORS.grid,
      lineWidth: 0.4,
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

  const creatorName = quote.createdByUser?.name ?? quote.createdBy ?? "-";
  const finalApproverName = approverName ?? quote.approvedByUser?.name ?? quote.approvedBy ?? "-";

  doc.text(t.signPrepared, sign1X + signWidth / 2, lineY + 12, { align: "center" });
  if (creatorName !== "-") {
    doc.text(creatorName, sign1X + signWidth / 2, lineY + 22, { align: "center" });
  }

  doc.text(t.signApproved, sign2X + signWidth / 2, lineY + 12, { align: "center" });
  if (finalApproverName !== "-") {
    doc.text(finalApproverName, sign2X + signWidth / 2, lineY + 22, { align: "center" });
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

  const flatItems: FlatItem[] = input.quote.items.map((item) => ({
    name: item.productName,
    quantity: item.quantity,
    unit: item.unit,
  }));

  cursorY = drawItemsTable(doc, flatItems, cursorY, autoTable, lang) + 30;

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
