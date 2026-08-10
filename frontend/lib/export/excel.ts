import * as XLSX from "xlsx";
import type { ReportData } from "./report-data";
import { formatDateTime } from "@/lib/format";

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

export function buildReportExcel(data: ReportData, selectedSections: string[] = ["all"]): Blob {
  const wb = XLSX.utils.book_new();
  const includeAll = selectedSections.includes("all");

  const targetSections = includeAll
    ? data.sections
    : data.sections.filter((s) => selectedSections.some((id) => matchSectionId(s.title, id)));

  // 1. Master Sheet containing selected sections stacked
  const sheetRows: (string | number)[][] = [
    [data.company],
    [data.title],
    ["Oluşturma Tarihi", formatDateTime(data.generatedAt.toISOString())],
    ["Dönem", data.rangeLabel],
    ["Oluşturan", data.generatedBy],
  ];

  if (includeAll || selectedSections.includes("kpi")) {
    sheetRows.push([]);
    sheetRows.push(["=== KPI ÖZETİ ==="]);
    sheetRows.push(["Metrik", "Değer"]);
    for (const kpi of data.kpis) {
      sheetRows.push([kpi.currency ? `${kpi.label} (USD)` : kpi.label, kpi.value]);
    }
  }

  for (const section of targetSections) {
    if (section.rows.length === 0) continue;
    sheetRows.push([]);
    sheetRows.push([`=== ${section.title.toUpperCase()} ===`]);
    sheetRows.push(section.columns);
    for (const r of section.rows) {
      sheetRows.push(r);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  setWorksheetFormatting(ws, sheetRows);
  XLSX.utils.book_append_sheet(wb, ws, "Özet & Rapor");

  // 2. Separate dedicated tabs for each selected section
  for (const section of targetSections) {
    if (section.rows.length === 0) continue;
    const tabRows: (string | number)[][] = [
      [section.title.toUpperCase()],
      [],
      section.columns,
      ...section.rows,
    ];
    const wsTab = XLSX.utils.aoa_to_sheet(tabRows);
    setWorksheetFormatting(wsTab, tabRows);
    const tabName = section.title.slice(0, 30).replace(/[:\\/?*\[\]]/g, "");
    XLSX.utils.book_append_sheet(wb, wsTab, tabName);
  }

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function setWorksheetFormatting(ws: XLSX.WorkSheet, rows: (string | number)[][]) {
  const colWidths: number[] = [];

  rows.forEach((r, rowIdx) => {
    r.forEach((val, colIdx) => {
      const strVal = String(val ?? "");
      colWidths[colIdx] = Math.max(colWidths[colIdx] || 0, strVal.length);

      const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
      if (ws[cellRef]) {
        const isHeader = strVal.startsWith("===") || rowIdx === 0 || strVal === "Metrik" || strVal === "Değer";
        ws[cellRef].s = {
          font: { bold: isHeader, name: "Calibri", sz: 11 },
          border: {
            top: { style: "thin", color: { rgb: "D1D5DB" } },
            bottom: { style: "thin", color: { rgb: "D1D5DB" } },
            left: { style: "thin", color: { rgb: "D1D5DB" } },
            right: { style: "thin", color: { rgb: "D1D5DB" } },
          },
        };
      }
    });
  });

  ws["!cols"] = colWidths.map((w) => ({ wch: Math.max(w + 5, 14) }));
}
