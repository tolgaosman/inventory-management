// Designed, multi-page PDF report.
//
// jsPDF, autoTable and the embedded font are all pulled in with dynamic
// imports so none of them reach the initial bundle — they load only when the
// user actually asks for a PDF.
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import type { ReportData, ReportSection } from "./report-data";
import { matchSectionId } from "./report-data";

/** Palette lifted from logo & branding (Turquoise, Sapphire Blue, Emerald). */
const COLORS = {
  brand: [8, 145, 178] as [number, number, number], // Turquoise / Cyan (#0891B2) matching logo!
  brandDark: [15, 76, 129] as [number, number, number], // Deep Sapphire Blue (#0F4C81) matching logo!
  brandTint: [238, 248, 250] as [number, number, number], // Soft Cyan tint
  ink: [17, 24, 39] as [number, number, number], // Slate 900
  secondary: [75, 85, 99] as [number, number, number], // Gray 600
  muted: [156, 163, 175] as [number, number, number], // Gray 400
  grid: [229, 231, 235] as [number, number, number], // Gray 200
  zebra: [248, 250, 252] as [number, number, number], // Slate 50
  white: [255, 255, 255] as [number, number, number],
  critical: [225, 29, 72] as [number, number, number], // Rose 600
  criticalTint: [255, 241, 242] as [number, number, number], // Rose 50
  inbound: [16, 185, 129] as [number, number, number], // Emerald green (#10B981) matching logo!
  outbound: [37, 99, 235] as [number, number, number], // Royal Blue (#2563EB) matching logo!
};

const MARGIN = 40;
const HEADER_HEIGHT = 74;
const FOOTER_HEIGHT = 30;

const FONT = "Roboto";

type Doc = import("jspdf").jsPDF;

function accentColor(accent: string | undefined): [number, number, number] {
  switch (accent) {
    case "critical":
      return COLORS.critical;
    case "in":
    case "good":
      return COLORS.inbound;
    case "out":
      return COLORS.outbound;
    default:
      return COLORS.brand;
  }
}

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
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const y = pageHeight - 18;

  doc.setDrawColor(...COLORS.grid);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y - 12, pageWidth - MARGIN, y - 12);

  doc.setFont(FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text(`${data.company} · ${data.title}`, MARGIN, y);
  doc.text(`Sayfa ${pageNumber} / ${pageCount}`, pageWidth - MARGIN, y, { align: "right" });
}

/** Section heading: a coloured vertical bar plus bold label. */
function drawSectionTitle(doc: Doc, title: string, y: number): number {
  doc.setFillColor(...COLORS.brand);
  doc.rect(MARGIN, y - 9, 3.5, 12, "F");

  doc.setFont(FONT, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.brandDark);
  doc.text(title, MARGIN + 10, y);
  return y + 8;
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
  const [{ jsPDF }, { autoTable }, fonts] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("./fonts/roboto"),
  ]);

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true });

  doc.addFileToVFS("Roboto-Regular.ttf", fonts.ROBOTO_REGULAR_BASE64);
  doc.addFont("Roboto-Regular.ttf", FONT, "normal");
  doc.addFileToVFS("Roboto-Bold.ttf", fonts.ROBOTO_BOLD_BASE64);
  doc.addFont("Roboto-Bold.ttf", FONT, "bold");
  doc.setFont(FONT, "normal");

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
      fontSize: 7.5,
      cellPadding: 4,
      textColor: COLORS.secondary,
      lineColor: COLORS.grid,
      lineWidth: 0.4,
      overflow: "linebreak",
      halign: "center",
      valign: "middle",
    },
    headStyles: {
      font: FONT,
      fontStyle: "bold",
      fillColor: COLORS.brand,
      textColor: COLORS.white,
      fontSize: 7.5,
      lineWidth: 0.4,
      halign: "center",
      valign: "middle",
    },
    alternateRowStyles: { fillColor: COLORS.zebra },
    didParseCell: (hook) => {
      if (hook.section !== "body") return;
      const rawText = String(hook.cell.raw ?? "").trim();
      const lowerText = rawText.toLowerCase();

      if (rawText === "Stok Girişi" || rawText === "Giriş" || lowerText === "aktif") {
        hook.cell.styles.fillColor = [198, 239, 206]; // Good Fill (#C6EFCE)
        hook.cell.styles.textColor = [0, 97, 0]; // Good Text (#006100)
        hook.cell.styles.fontStyle = "bold";
      } else if (rawText === "Stok Çıkışı" || rawText === "Çıkış" || lowerText === "pasif") {
        hook.cell.styles.fillColor = [255, 199, 206]; // Bad Fill (#FFC7CE)
        hook.cell.styles.textColor = [156, 0, 6]; // Bad Text (#9C0006)
        hook.cell.styles.fontStyle = "bold";
      } else if (rawText === "Transfer") {
        hook.cell.styles.fillColor = [255, 235, 156]; // Neutral Fill (#FFEB9C)
        hook.cell.styles.textColor = [156, 101, 0]; // Neutral Text (#9C6500)
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
