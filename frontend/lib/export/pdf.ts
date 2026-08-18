// Designed, multi-page PDF report.
//
// jsPDF, autoTable and the embedded font are all pulled in with dynamic
// imports so none of them reach the initial bundle — they load only when the
// user actually asks for a PDF.
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import type { ReportData, ReportSection } from "./report-data";
import { matchSectionId } from "./report-data";
import {
  COLORS,
  MARGIN,
  HEADER_HEIGHT,
  FOOTER_HEIGHT,
  FONT,
  type Doc,
  accentColor,
  createPdfDoc,
  drawFooter as drawFooterBand,
  drawSectionTitle,
} from "./pdf-theme";

/** Report title band, repeated at the top of every page. */
function drawHeader(doc: Doc, data: ReportData) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont(FONT, "bold");
  doc.setFontSize(15);
  doc.setTextColor(...COLORS.brandDark);
  doc.text(data.company, MARGIN, 40);

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.secondary);
  doc.text(data.title, MARGIN, 55);

  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  const right = pageWidth - MARGIN;
  doc.text(`Oluşturma: ${formatDateTime(data.generatedAt.toISOString())}`, right, 34, {
    align: "right",
  });
  doc.text(`Dönem: ${data.rangeLabel}`, right, 46, { align: "right" });
  doc.text(`Oluşturan: ${data.generatedBy}`, right, 58, { align: "right" });

  // Top header lines: Turquoise & Sapphire Blue matching logo!
  doc.setDrawColor(...COLORS.brand);
  doc.setLineWidth(2);
  doc.line(MARGIN, HEADER_HEIGHT - 8, right, HEADER_HEIGHT - 8);

  doc.setDrawColor(...COLORS.brandDark);
  doc.setLineWidth(1);
  doc.line(MARGIN, HEADER_HEIGHT - 5, right, HEADER_HEIGHT - 5);
}

function drawFooter(doc: Doc, data: ReportData, pageNumber: number, pageCount: number) {
  drawFooterBand(doc, `${data.company} · ${data.title}`, pageNumber, pageCount);
}

/** KPI cards: 3 per row, rounded outline, label above value. */
function drawKpiGrid(doc: Doc, data: ReportData, startY: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const usable = pageWidth - MARGIN * 2;
  const perRow = 3;
  const gap = 10;
  const cardWidth = (usable - gap * (perRow - 1)) / perRow;
  const cardHeight = 46;

  let y = startY;
  data.kpis.forEach((kpi, i) => {
    const col = i % perRow;
    if (col === 0 && i > 0) y += cardHeight + gap;
    const x = MARGIN + col * (cardWidth + gap);

    doc.setFillColor(...COLORS.white);
    doc.setDrawColor(...COLORS.grid);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, y, cardWidth, cardHeight, 5, 5, "FD");

    // Accent stripe down the left edge of the card.
    doc.setFillColor(...accentColor(kpi.accent));
    doc.roundedRect(x, y + 8, 2.5, cardHeight - 16, 1.5, 1.5, "F");

    doc.setFont(FONT, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(kpi.label.toLocaleUpperCase("tr-TR"), x + 10, y + 17);

    doc.setFont(FONT, "bold");
    doc.setFontSize(14);
    doc.setTextColor(...accentColor(kpi.accent));
    const value = kpi.currency ? formatCurrency(kpi.value, data.currency) : formatNumber(kpi.value);
    doc.text(value, x + 10, y + 35);
  });

  return y + cardHeight + 18;
}

export async function buildReportPdf(data: ReportData, selectedSections: string[] = ["all"]): Promise<Blob> {
  // Landscape — these tables can run to a dozen-plus columns (e.g. the full
  // product catalog); the extra width keeps every cell on one line without
  // crushing it down to a couple of ellipsized characters.
  const { doc, autoTable } = await createPdfDoc("landscape");

  doc.setProperties({
    title: `${data.company} — ${data.title}`,
    subject: `Dönem: ${data.rangeLabel}`,
    author: data.generatedBy,
    creator: data.company,
  });

  drawHeader(doc, data);

  let cursorY = HEADER_HEIGHT + 18;
  const includeAll = selectedSections.includes("all");

  if ((includeAll || selectedSections.includes("kpi")) && data.kpis.length > 0) {
    cursorY = drawSectionTitle(doc, "Özet", cursorY);
    cursorY = drawKpiGrid(doc, data, cursorY);
  }

  const targetSections = includeAll
    ? data.sections
    : data.sections.filter((s) => selectedSections.some((id) => matchSectionId(s.title, id)));

  for (const section of targetSections) {
    cursorY = renderSection(doc, data, section, cursorY, autoTable);
  }

  // Page numbers need the final count, so stamp footers once everything is laid
  // out. Headers on pages 2+ are added here too (page 1 was drawn above).
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    if (page > 1) drawHeader(doc, data);
    drawFooter(doc, data, page, pageCount);
  }

  return doc.output("blob");
}

function renderSection(
  doc: Doc,
  data: ReportData,
  section: ReportSection,
  cursorY: number,
  autoTable: typeof import("jspdf-autotable").autoTable,
): number {
  const pageHeight = doc.internal.pageSize.getHeight();

  // Don't strand a section heading at the very bottom of a page.
  if (cursorY > pageHeight - FOOTER_HEIGHT - 90) {
    doc.addPage();
    cursorY = HEADER_HEIGHT + 18;
  }

  const y = drawSectionTitle(doc, section.title, cursorY);

  if (section.rows.length === 0) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(section.emptyMessage, MARGIN + 10, y + 10);
    return y + 30;
  }

  const isCritical = section.title === "Kritik Stok";
  const shortfallColumn = section.columns.length - 1;

  autoTable(doc, {
    startY: y + 4,
    head: [section.columns],
    body: section.rows.map((row) =>
      row.map((val, colIdx) => {
        if (typeof val === "number") {
          if (section.currencyColumns?.includes(colIdx)) {
            return formatCurrency(val, data.currency);
          }
          return formatNumber(val);
        }
        return val;
      }),
    ),
    margin: { left: MARGIN, right: MARGIN, top: HEADER_HEIGHT + 10, bottom: FOOTER_HEIGHT + 10 },
    styles: {
      font: FONT,
      fontStyle: "normal",
      fontSize: 10,
      cellPadding: { top: 7, right: 6, bottom: 7, left: 6 },
      textColor: COLORS.secondary,
      lineColor: COLORS.grid,
      lineWidth: 0.4,
      // Keep every cell to a single line — long values get an ellipsis
      // instead of wrapping and blowing up the row height.
      overflow: "ellipsize",
      halign: "center",
      valign: "middle",
      minCellHeight: 24,
    },
    headStyles: {
      font: FONT,
      fontStyle: "bold",
      fillColor: COLORS.brand,
      textColor: COLORS.white,
      fontSize: 10,
      lineWidth: 0.4,
      overflow: "ellipsize",
      halign: "center",
      valign: "middle",
      minCellHeight: 26,
    },
    alternateRowStyles: { fillColor: COLORS.zebra },
    didParseCell: (hook) => {
      if (hook.section !== "body") return;
      const rawText = String(hook.cell.raw ?? "").trim();
      const lowerText = rawText.toLowerCase();

      if (rawText === "Stok Girişi" || rawText === "Giriş" || lowerText === "aktif" || rawText === "Teslim Alındı") {
        hook.cell.styles.fillColor = [198, 239, 206]; // Good Fill (#C6EFCE)
        hook.cell.styles.textColor = [0, 97, 0]; // Good Text (#006100)
        hook.cell.styles.fontStyle = "bold";
      } else if (rawText === "Stok Çıkışı" || rawText === "Çıkış" || lowerText === "pasif" || rawText === "İptal Edildi") {
        hook.cell.styles.fillColor = [255, 199, 206]; // Bad Fill (#FFC7CE)
        hook.cell.styles.textColor = [156, 0, 6]; // Bad Text (#9C0006)
        hook.cell.styles.fontStyle = "bold";
      } else if (rawText === "Transfer" || rawText === "Kısmen Teslim Alındı") {
        hook.cell.styles.fillColor = [255, 235, 156]; // Neutral Fill (#FFEB9C)
        hook.cell.styles.textColor = [156, 101, 0]; // Neutral Text (#9C6500)
        hook.cell.styles.fontStyle = "bold";
        if (rawText === "Kısmen Teslim Alındı") {
          hook.cell.styles.fontSize = 8.5; // Biraz küçülttük ki sığsın
        }
      } else if (rawText === "Sipariş Edildi") {
        hook.cell.styles.fillColor = [180, 198, 231]; // 60% Accent 5 (#B4C6E7)
        hook.cell.styles.textColor = [31, 73, 125]; // Dark Blue, Text 2, Darker 50% (#1F497D)
        hook.cell.styles.fontStyle = "bold";
      } else if (rawText === "Taslak") {
        hook.cell.styles.fillColor = [242, 242, 242]; // Output Fill (#F2F2F2)
        hook.cell.styles.textColor = [63, 63, 63]; // Output Text (#3F3F3F)
        hook.cell.styles.fontStyle = "bold";
      } else if (rawText === "Onay Bekliyor") {
        hook.cell.styles.fillColor = [252, 224, 165]; // Amber Fill (#FCE0A5)
        hook.cell.styles.textColor = [146, 91, 4]; // Amber Text (#925B04)
        hook.cell.styles.fontStyle = "bold";
      } else if (isCritical) {
        // Flag under-stocked rows, and make the shortfall itself stand out.
        hook.cell.styles.fillColor = COLORS.criticalTint;
        if (hook.column.index === shortfallColumn) {
          hook.cell.styles.textColor = COLORS.critical;
          hook.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
  return (finalY ?? y) + 26;
}
