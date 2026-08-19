// Satın Alma Siparişi detay çıktısı — quote-pdf.ts ile aynı görsel dil
// (logo + başlık, iki sütunlu meta blok, kalem tablosu, toplam kutusu,
// notlar) ama tedarikçiye giden bir teklif formu değil, siparişin kendisinin
// yazdırılabilir/PDF hali.
import type { RowInput } from "jspdf-autotable";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { PURCHASE_STATUS_LABELS } from "@/lib/constants";
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
import type { PurchaseOrderDetail } from "@/lib/api/purchase-orders";
import type { Supplier, Warehouse } from "@/lib/types";
import type { CompanySettings } from "@/lib/settings-context";

export interface PurchaseOrderDocument {
  order: PurchaseOrderDetail;
  supplier?: Supplier;
  warehouse?: Warehouse;
  company: CompanySettings;
}

const PRIORITY_LABELS: Record<"low" | "medium" | "high", string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
};

/** Logo + company name on the left, "SATIN ALMA SİPARİŞİ" + code / date on the right. */
async function drawHeader(doc: Doc, order: PurchaseOrderDetail, company: CompanySettings): Promise<number> {
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
  doc.text("SATIN ALMA SİPARİŞİ", MARGIN, y);

  y += 16;

  doc.setFont(FONT, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.muted);
  doc.text(`${formatDate(order.createdAt)}   ·   Sipariş No: ${order.code}`, MARGIN, y);

  return y + 20;
}

/** One label/value pair, wrapped onto as many lines as it needs rather than ellipsized — returns the line count drawn. */
function drawMetaField(doc: Doc, label: string, value: string, x: number, y: number, colWidth: number): number {
  if (!label) return 0;

  doc.setFont(FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.secondary);
  doc.text(label, x, y);

  const labelWidth = doc.getTextWidth(label) + 5;
  doc.setFont(FONT, "normal");
  doc.setTextColor(...COLORS.ink);
  const wrapped: string[] = doc.splitTextToSize(value, colWidth - labelWidth);
  doc.text(wrapped, x + labelWidth, y);
  return wrapped.length;
}

/** Two-column meta block: supplier / delivery / creator on the left, status / dates / approver on the right. Values wrap onto extra lines instead of being cut off. */
function drawMetaBlock(
  doc: Doc,
  order: PurchaseOrderDetail,
  supplier: Supplier | undefined,
  warehouse: Warehouse | undefined,
  y: number,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const leftX = MARGIN;
  const rightX = pageWidth / 2;
  const colWidth = pageWidth / 2 - MARGIN - 8;
  const lineHeight = 11;
  const rowGap = 5;

  const supplierContact = supplier ? [supplier.email, supplier.phone].filter(Boolean).join("  ·  ") : "";
  const warehouseAddress = warehouse ? `${warehouse.name} — ${warehouse.address}` : order.warehouseName;

  const leftRows: [string, string][] = [
    ["Tedarikçi:", order.supplierName],
    ["İletişim:", supplierContact || "-"],
    ["Teslim Deposu:", warehouseAddress],
    ...(order.createdBy ? ([["Oluşturan:", order.createdBy]] as [string, string][]) : []),
  ];
  const rightRows: [string, string][] = [
    ["Durum:", PURCHASE_STATUS_LABELS[order.status]],
    ["Öncelik:", PRIORITY_LABELS[order.priority]],
    ["Beklenen Teslim:", formatDate(order.expectedAt)],
    ...(order.receivedAt ? ([["Teslim Alındı:", formatDateTime(order.receivedAt)]] as [string, string][]) : []),
    ...(order.approvedBy ? ([["Onaylayan:", order.approvedBy]] as [string, string][]) : []),
  ];
  const rowCount = Math.max(leftRows.length, rightRows.length);

  let cursorY = y;
  for (let i = 0; i < rowCount; i++) {
    const [leftLabel, leftValue] = leftRows[i] ?? ["", ""];
    const [rightLabel, rightValue] = rightRows[i] ?? ["", ""];

    const leftLines = drawMetaField(doc, leftLabel, leftValue, leftX, cursorY, colWidth);
    const rightLines = drawMetaField(doc, rightLabel, rightValue, rightX, cursorY, colWidth);

    cursorY += Math.max(leftLines, rightLines, 1) * lineHeight + rowGap;
  }

  return cursorY;
}

function drawItemsTable(
  doc: Doc,
  order: PurchaseOrderDetail,
  cursorY: number,
  autoTable: typeof import("jspdf-autotable").autoTable,
): number {
  const symbol = CURRENCY_SYMBOLS.try;

  const body: RowInput[] = order.items.map((item, i) => [
    String(i + 1),
    item.product.sku,
    item.product.name,
    String(item.quantity),
    item.product.unit,
    formatCurrency(item.unitPrice, "try"),
    formatCurrency(item.quantity * item.unitPrice, "try"),
  ]);

  const subtotal = order.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  body.push([
    { content: `GENEL TOPLAM (${symbol})`, colSpan: 6, styles: { halign: "right", fontStyle: "bold", fillColor: COLORS.brandDark, textColor: COLORS.white } },
    { content: formatCurrency(subtotal, "try"), styles: { halign: "right", fontStyle: "bold", fillColor: COLORS.brandDark, textColor: COLORS.white } },
  ]);

  autoTable(doc, {
    startY: cursorY,
    head: [["No", "Ürün Kodu", "Ürün Adı", "Miktar", "Birim", `Birim Fiyat (${symbol})`, `Toplam (${symbol})`]],
    body,
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN, top: MARGIN + 10, bottom: FOOTER_HEIGHT + 10 },
    columnStyles: {
      0: { cellWidth: 24, halign: "center", cellPadding: { top: 7, right: 2, bottom: 7, left: 2 } },
      1: { cellWidth: 78, halign: "left", overflow: "linebreak" },
      2: { cellWidth: "auto", halign: "left", overflow: "linebreak" },
      3: { cellWidth: 42, halign: "center" },
      4: { cellWidth: 42, halign: "center" },
      5: { cellWidth: 82, halign: "right" },
      6: { cellWidth: 88, halign: "right" },
    },
    styles: {
      font: FONT,
      fontStyle: "normal",
      fontSize: 9,
      cellPadding: { top: 7, right: 6, bottom: 7, left: 6 },
      textColor: COLORS.ink,
      lineColor: COLORS.grid,
      lineWidth: 0.4,
      // Wrap instead of ellipsize — a long product name grows the row
      // rather than losing characters off the edge.
      overflow: "linebreak",
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
      overflow: "linebreak",
      halign: "center",
      valign: "middle",
      minCellHeight: 24,
    },
  });

  return (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? cursorY;
}

function drawNotes(doc: Doc, order: PurchaseOrderDetail, y: number) {
  if (!order.notes) return;
  const pageWidth = doc.internal.pageSize.getWidth();
  const width = pageWidth - MARGIN * 2;

  doc.setFont(FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.ink);
  doc.text("Notlar", MARGIN, y);

  doc.setFont(FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.secondary);
  const wrapped = doc.splitTextToSize(order.notes, width);
  doc.text(wrapped, MARGIN, y + 13);
  return y + 13 + wrapped.length * 11;
}

function drawRejectionReason(doc: Doc, order: PurchaseOrderDetail, y: number) {
  if (order.status !== "cancelled" || !order.rejectionReason) return;
  const pageWidth = doc.internal.pageSize.getWidth();
  const width = pageWidth - MARGIN * 2;

  doc.setFont(FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(220, 38, 38); // red for critical
  doc.text("İptal / Ret Gerekçesi", MARGIN, y);

  doc.setFont(FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(220, 38, 38);
  const wrapped = doc.splitTextToSize(order.rejectionReason, width);
  doc.text(wrapped, MARGIN, y + 13);
  return y + 13 + wrapped.length * 11;
}

export async function buildPurchaseOrderPdf(input: PurchaseOrderDocument): Promise<Blob> {
  const { doc, autoTable } = await createPdfDoc();
  const { order } = input;

  doc.setProperties({
    title: `${input.company.companyName} — Satın Alma Siparişi ${order.code}`,
    subject: `Sipariş No: ${order.code}`,
    creator: input.company.companyName,
  });

  let cursorY = await drawHeader(doc, order, input.company);
  cursorY = drawMetaBlock(doc, order, input.supplier, input.warehouse, cursorY);
  cursorY = drawItemsTable(doc, order, cursorY + 10, autoTable) + 30;

  const pageHeight = doc.internal.pageSize.getHeight();
  if (cursorY > pageHeight - FOOTER_HEIGHT - 60) {
    doc.addPage();
    cursorY = MARGIN + 20;
  }
  
  if (order.status === "cancelled" && order.rejectionReason) {
    cursorY = drawRejectionReason(doc, order, cursorY) ?? cursorY;
    cursorY += 20; // gap before notes if any
  }
  
  if (order.notes) {
    drawNotes(doc, order, cursorY);
  }

  const pageCount = doc.getNumberOfPages();
  const footerTitle = `Satın Alma Siparişi · ${order.code}`;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(doc, footerTitle, i, pageCount);
  }

  return doc.output("blob");
}
