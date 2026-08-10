import { formatDateTime } from "@/lib/format";
import type { ReportData } from "./report-data";

const DELIMITER = ";";

function escapeCell(value: string | number): string {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  const str = String(value);
  const needsQuoting = str.includes(DELIMITER) || str.includes('"') || str.includes("\n") || str.includes("\r");
  return needsQuoting ? `"${str.replace(/"/g, '""')}"` : str;
}

function row(cells: (string | number)[]): string {
  return cells.map(escapeCell).join(DELIMITER);
}

export function buildReportCsv(data: ReportData): Blob {
  const lines: string[] = [];

  lines.push(row([data.company]));
  lines.push(row([data.title]));
  lines.push(row(["Oluşturma Tarihi", formatDateTime(data.generatedAt.toISOString())]));
  lines.push(row(["Dönem", data.rangeLabel]));
  lines.push(row(["Oluşturan", data.generatedBy]));

  lines.push("");
  lines.push(row(["=== ÖZET ==="]));
  lines.push(row(["Metrik", "Değer"]));
  for (const kpi of data.kpis) {
    lines.push(row([kpi.currency ? `${kpi.label} (USD)` : kpi.label, kpi.value]));
  }

  for (const section of data.sections) {
    lines.push("");
    lines.push(row([`=== ${section.title.toUpperCase()} ===`]));
    if (section.rows.length === 0) {
      lines.push(row([section.emptyMessage]));
      continue;
    }
    lines.push(row(section.columns));
    for (const r of section.rows) lines.push(row(r));
  }

  // Explicit UTF-8 BOM (\uFEFF) forces Excel on Windows to parse as UTF-8
  const BOM = "\uFEFF";
  const csvText = BOM + lines.join("\r\n");
  return new Blob([csvText], { type: "text/csv;charset=utf-8;" });
}
