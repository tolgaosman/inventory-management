// Designed, multi-page PDF report.
//
// jsPDF, autoTable and the embedded font are all pulled in with dynamic
// imports so none of them reach the initial bundle — they load only when the
// user actually asks for a PDF.
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import type { ReportData, ReportSection } from "./report-data";

/** Palette lifted from app/globals.css so the PDF matches the UI. */
const COLORS = {
  brand: [22, 163, 74] as [number, number, number],
  brandTint: [232, 246, 238] as [number, number, number],
  ink: [11, 11, 11] as [number, number, number],
  secondary: [82, 81, 78] as [number, number, number],
  muted: [137, 135, 129] as [number, number, number],
  grid: [225, 224, 217] as [number, number, number],
  zebra: [250, 250, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  critical: [208, 59, 59] as [number, number, number],
  criticalTint: [251, 233, 233] as [number, number, number],
  inbound: [27, 175, 122] as [number, number, number],
  outbound: [42, 120, 214] as [number, number, number],
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
      return COLORS.ink;
  }
}

/** Report title band, repeated at the top of every page. */
function drawHeader(doc: Doc, data: ReportData) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont(FONT, "bold");
  doc.setFontSize(15);
  doc.setTextColor(...COLORS.ink);
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

  doc.setDrawColor(...COLORS.brand);
  doc.setLineWidth(1.5);
  doc.line(MARGIN, HEADER_HEIGHT - 8, right, HEADER_HEIGHT - 8);
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
  doc.rect(MARGIN, y - 9, 3, 12, "F");

  doc.setFont(FONT, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.ink);
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
    const value = kpi.currency ? formatCurrency(kpi.value) : formatNumber(kpi.value);
    doc.text(value, x + 10, y + 35);
  });

  return y + cardHeight + 18;
}

/** Numbers are formatted here (tr-TR) rather than in report-data. */
function renderCell(value: string | number): string {
  return typeof value === "number" ? formatNumber(value) : value;
}

function matchSectionId(title: string, id: string): boolean {
  const t = title.toLocaleLowerCase("tr-TR");
  switch (id) {
    case "kpi":
      return t.includes("özet") || t.includes("kpi");
    case "critical":
      return t.includes("kritik");
    case "movements":
      return t.includes("hareket");
    case "warehouse":
      return t.includes("depo");
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

  if (includeAll || selectedSections.includes("kpi")) {
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

  let y = drawSectionTitle(doc, section.title, cursorY);

  if (section.rows.length === 0) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(section.emptyMessage, MARGIN + 10, y + 10);
    return y + 30;
  }

  const isCritical = section.title === "Kritik Stok";
  const shortfallColumn = section.columns.length - 1;

  const columnStyles: Record<number, { halign: "right" }> = {};
  for (const index of section.numericColumns) columnStyles[index] = { halign: "right" };

  autoTable(doc, {
    startY: y + 4,
    head: [section.columns],
    body: section.rows.map((row) => row.map(renderCell)),
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
    },
    headStyles: {
      font: FONT,
      fontStyle: "bold",
      fillColor: COLORS.brand,
      textColor: COLORS.white,
      fontSize: 7.5,
      lineWidth: 0.4,
    },
    alternateRowStyles: { fillColor: COLORS.zebra },
    columnStyles,
    didParseCell: (hook) => {
      if (!isCritical || hook.section !== "body") return;
      // Flag under-stocked rows, and make the shortfall itself stand out.
      hook.cell.styles.fillColor = COLORS.criticalTint;
      if (hook.column.index === shortfallColumn) {
        hook.cell.styles.textColor = COLORS.critical;
        hook.cell.styles.fontStyle = "bold";
      }
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
  return (finalY ?? y) + 26;
}
