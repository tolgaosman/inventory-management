import type { ReportData } from "./report-data";
import { matchSectionId, CURRENCY_SYMBOLS } from "./report-data";
import { formatDateTime } from "@/lib/format";

export function buildReportCsv(data: ReportData, selectedSections: string[] = ["all"]): Blob {
  const includeAll = selectedSections.includes("all");

  const targetSections = includeAll
    ? data.sections
    : data.sections.filter((s) => selectedSections.some((id) => matchSectionId(s.title, id)));

  const rows: string[][] = [];

  // Header / Metadata
  rows.push([data.company]);
  rows.push([data.title]);
  rows.push(["Oluşturma Tarihi", formatDateTime(data.generatedAt.toISOString())]);
  rows.push(["Dönem", data.rangeLabel]);
  rows.push(["Oluşturan", data.generatedBy]);
  rows.push([]);

  // KPIs if applicable
  if ((includeAll || selectedSections.includes("kpi")) && data.kpis.length > 0) {
    rows.push(["=== KPI ÖZETİ ==="]);
    rows.push(["Metrik", "Değer"]);
    const symbol = CURRENCY_SYMBOLS[data.currency];
    for (const kpi of data.kpis) {
      rows.push([kpi.currency ? `${kpi.label} (${symbol})` : kpi.label, String(kpi.value)]);
    }
    rows.push([]);
  }

  // Sections
  for (const section of targetSections) {
    if (section.rows.length === 0) continue;
    rows.push([`=== ${section.title.toUpperCase()} ===`]);
    rows.push(section.columns);
    for (const r of section.rows) {
      rows.push(r.map((cell) => String(cell)));
    }
    rows.push([]);
  }

  // Convert to CSV string with semicolons (Excel Turkish standard)
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          const escaped = cell.replace(/"/g, '""');
          if (escaped.includes(";") || escaped.includes("\n") || escaped.includes('"')) {
            return `"${escaped}"`;
          }
          return escaped;
        })
        .join(";"),
    )
    .join("\r\n");

  const bom = "\uFEFF";
  return new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
}
