import { formatDate, formatDateShort } from "@/lib/format";
import { CURRENCY_SYMBOLS } from "./report-data";
import { COLORS, MARGIN, FOOTER_HEIGHT, FONT, type Doc, createPdfDoc, drawFooter, loadBrandLogo } from "./pdf-theme";
import type { CompanySettings } from "@/lib/settings-context";
import { getPurchaseOrder } from "@/lib/api/purchase-orders";
import { suppliers } from "@/lib/mock/data";

export type PurchaseOrderDetail = Awaited<ReturnType<typeof getPurchaseOrder>>;

export interface InvoiceDocument {
  order: PurchaseOrderDetail;
  company: CompanySettings;
  approverName: string;
  language: "tr" | "en";
}

const PRIMARY = COLORS.brandDark;
const DARK_GRAY = COLORS.ink;
const LIGHT_GRAY = COLORS.secondary;
const LINE_COLOR = COLORS.grid;

const DICT = {
  tr: {
    invoice: "FATURA",
    dateIssued: "Tarih:",
    invoiceNo: "Fatura No:",
    description: "AÇIKLAMA",
    rate: "FİYAT",
    qty: "MİKTAR",
    subtotal: "TUTAR",
    bankInfo: "BANKA BİLGİLERİ",
    accountNo: "Hesap No:",
    sortCode: "Şube Kodu:",
    dueBy: "SON ÖDEME",
    totalDue: "GENEL TOPLAM",
    thankYou: "Teşekkürler!",
    approvedBy: "Onaylayan:",
  },
  en: {
    invoice: "INVOICE",
    dateIssued: "Date Issued:",
    invoiceNo: "Invoice No:",
    description: "DESCRIPTION",
    rate: "RATE",
    qty: "QTY",
    subtotal: "SUBTOTAL",
    bankInfo: "BANK INFO",
    accountNo: "Account No:",
    sortCode: "Sort Code:",
    dueBy: "DUE BY",
    totalDue: "TOTAL DUE",
    thankYou: "Thank you!",
    approvedBy: "Approved by:",
  },
};

async function drawHeader(doc: Doc, order: PurchaseOrderDetail, company: CompanySettings, lang: "tr" | "en"): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = MARGIN + 10;
  const t = DICT[lang];
  let logoBottomY = y + 24;

  // Site Logo & Company Name
  const logo = await loadBrandLogo();
  if (logo) {
    const targetHeight = 24;
    const targetWidth = targetHeight * (logo.width / logo.height);

    doc.addImage(logo.dataUrl, "PNG", MARGIN, y, targetWidth, targetHeight);

    // Company name to the right of the logo
    doc.setFont(FONT, "normal");
    doc.setFontSize(16);
    doc.setTextColor(...DARK_GRAY);
    doc.text(company.companyName, MARGIN + targetWidth + 10, y + 16);

    logoBottomY = y + targetHeight;
  } else {
    // Fallback if logo fails
    doc.setFont(FONT, "bold");
    doc.setFontSize(20);
    doc.setTextColor(...PRIMARY);
    doc.text(company.companyName, MARGIN, y + 16);
  }
  
  // "INVOICE" text next to logo / aligned right
  doc.setFont(FONT, "bold");
  doc.setFontSize(22);
  doc.setTextColor(...DARK_GRAY);
  doc.text(t.invoice, pageWidth - MARGIN, y + 18, { align: "right" });

  y = logoBottomY + 36;

  // Date and Invoice No
  doc.setFontSize(8);
  doc.setTextColor(...LIGHT_GRAY);
  const formattedDate = new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-US", { dateStyle: "medium" }).format(new Date(order.createdAt));
  doc.text(`${t.dateIssued} ${formattedDate}`, MARGIN, y);
  doc.text(`${t.invoiceNo}  ${order.code}`, MARGIN, y + 12);

  // Supplier Name on the right
  const rightX = pageWidth - MARGIN;
  doc.setFont(FONT, "normal");
  doc.setFontSize(8);
  doc.text(order.supplierName, rightX, y, { align: "right" });
  
  return y + 40;
}

function drawInvoiceTable(
  doc: Doc,
  order: PurchaseOrderDetail,
  currencySymbol: string,
  cursorY: number,
  autoTable: typeof import("jspdf-autotable").autoTable,
  lang: "tr" | "en"
): number {
  const t = DICT[lang];
  const rows = order.items.map((item: any) => [
    item.product.name,
    `${currencySymbol}${(item.unitPrice || 0).toFixed(2)}`,
    item.quantity.toString(),
    `${currencySymbol}${((item.unitPrice || 0) * item.quantity).toFixed(2)}`,
  ]);

  const head = [[
    { content: t.description, styles: { halign: "left" } },
    { content: t.rate, styles: { halign: "right" } },
    { content: t.qty, styles: { halign: "center" } },
    { content: t.subtotal, styles: { halign: "right" } },
  ]];

  autoTable(doc, {
    startY: cursorY,
    head: head as any,
    body: rows,
    theme: "plain",
    styles: {
      font: FONT,
      fontSize: 9,
      textColor: LIGHT_GRAY,
      cellPadding: { top: 12, right: 8, bottom: 12, left: 0 },
      // Single-line cells — a long product name gets an ellipsis instead of
      // wrapping onto a second line and cramping the row.
      overflow: "ellipsize",
    },
    headStyles: {
      fontStyle: "bold",
      fontSize: 7,
      textColor: LIGHT_GRAY,
      overflow: "ellipsize",
    },
    bodyStyles: {
      textColor: DARK_GRAY,
    },
    columnStyles: {
      0: { cellWidth: "auto" }, // Description
      1: { cellWidth: 70, halign: "right" }, // Rate
      2: { cellWidth: 50, halign: "center" }, // Qty
      3: { cellWidth: 80, halign: "right", fontStyle: "bold", textColor: PRIMARY }, // Subtotal
    },
    margin: { left: MARGIN, right: MARGIN },
    didDrawCell: (data) => {
      // Draw a subtle line under the header
      if (data.row.section === "head" && data.row.index === 0) {
        doc.setDrawColor(...LINE_COLOR);
        doc.setLineWidth(0.5);
        doc.line(
          data.cell.x,
          data.cell.y + data.cell.height,
          data.cell.x + data.cell.width,
          data.cell.y + data.cell.height
        );
      }
    },
  });

  return (doc as any).lastAutoTable.finalY + 30;
}

function drawTotalFooter(doc: Doc, order: PurchaseOrderDetail, currencySymbol: string, y: number, approverName: string, lang: "tr" | "en") {
  const pageWidth = doc.internal.pageSize.getWidth();
  const t = DICT[lang];
  
  // Top line for footer block
  doc.setDrawColor(...LINE_COLOR);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  
  y += 20;

  // BANK INFO
  doc.setFont(FONT, "bold");
  doc.setFontSize(7);
  doc.setTextColor(...DARK_GRAY);
  doc.text(t.bankInfo, MARGIN, y);
  
  doc.setFont(FONT, "normal");
  doc.setFontSize(8);
  doc.text(`${t.accountNo} 123 456 78`, MARGIN, y + 14);
  doc.text(`${t.sortCode}  01 23 45`, MARGIN, y + 26);

  // DUE BY
  const dueDate = new Date(order.createdAt);
  dueDate.setDate(dueDate.getDate() + 30);
  
  doc.setFont(FONT, "bold");
  doc.setFontSize(7);
  doc.text(t.dueBy, pageWidth / 2, y, { align: "center" });
  
  doc.setFont(FONT, "normal");
  doc.setFontSize(14);
  const formatter = new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-US", { day: "numeric", month: "long" });
  doc.text(formatter.format(dueDate), pageWidth / 2, y + 20, { align: "center" });

  // TOTAL DUE
  doc.setFont(FONT, "bold");
  doc.setFontSize(7);
  doc.text(t.totalDue, pageWidth - MARGIN, y, { align: "right" });
  
  // Total amount in red
  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  doc.setTextColor(...PRIMARY);
  const total = order.items.reduce((sum: number, i: any) => sum + (i.unitPrice * i.quantity), 0);
  doc.text(`${currencySymbol}${total.toFixed(2)}`, pageWidth - MARGIN, y + 18, { align: "right" });
  
  // Bottom line for footer block
  y += 35;
  doc.setDrawColor(...LINE_COLOR);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  
  // "Thank you!" on the left
  y += 30;
  doc.setFillColor(...PRIMARY);
  doc.circle(MARGIN + 3, y - 3, 3, "F");
  doc.setFont(FONT, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK_GRAY);
  doc.text(t.thankYou, MARGIN + 12, y);

  // Signature Block on the right
  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...LIGHT_GRAY);
  doc.text(t.approvedBy, pageWidth - MARGIN - 120, y);
  
  doc.setFont(FONT, "bold");
  doc.setTextColor(...DARK_GRAY);
  doc.text(approverName || "Yetkili", pageWidth - MARGIN - 120, y + 12);
  
  // Line for signature
  doc.setDrawColor(...LINE_COLOR);
  doc.setLineWidth(0.5);
  doc.line(pageWidth - MARGIN - 120, y + 35, pageWidth - MARGIN, y + 35);
}

export async function buildInvoicePdf(input: InvoiceDocument): Promise<Blob> {
  const { doc, autoTable } = await createPdfDoc();
  const lang = input.language || "tr";
  
  // Standardize currency
  const symbol = CURRENCY_SYMBOLS["try"] ?? "₺"; // For simplicity, assume TRY or get from settings if needed

  let cursorY = await drawHeader(doc, input.order, input.company, lang);
  cursorY = drawInvoiceTable(doc, input.order, symbol, cursorY, autoTable, lang);
  
  // If we're too far down, add a page for footer
  if (cursorY > doc.internal.pageSize.getHeight() - FOOTER_HEIGHT - 120) {
    doc.addPage();
    cursorY = MARGIN;
  }
  
  drawTotalFooter(doc, input.order, symbol, cursorY, input.approverName, lang);

  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Use the theme's footer
    const footerText = lang === "tr" ? "Fatura - " + input.company.companyName : "Invoice - " + input.company.companyName;
    drawFooter(doc, footerText, i, pageCount);
  }

  return new Blob([doc.output("arraybuffer")], { type: "application/pdf" });
}
