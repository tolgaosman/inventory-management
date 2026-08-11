import * as XLSX from "xlsx-js-style";
import type { ReportData } from "./report-data";
import { matchSectionId } from "./report-data";

export function buildReportExcel(data: ReportData, selectedSections: string[] = ["all"]): Blob {
  const wb = XLSX.utils.book_new();
  const includeAll = selectedSections.includes("all");

  const targetSections = includeAll
    ? data.sections
    : data.sections.filter((s) => selectedSections.some((id) => matchSectionId(s.title, id)));

  const sheetRows: (string | number)[][] = [];
  const headerRowIndexes = new Set<number>();

  for (const section of targetSections) {
    if (section.rows.length === 0) continue;
    if (sheetRows.length > 0) sheetRows.push([]); // Gap between sections if multiple
    
    headerRowIndexes.add(sheetRows.length);
    sheetRows.push(section.columns);
    for (const r of section.rows) {
      sheetRows.push(r);
    }
  }

  // Fallback if no sections
  if (sheetRows.length === 0) {
    sheetRows.push(["Bilgi"]);
    sheetRows.push(["Gösterilecek veri bulunamadı."]);
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  setWorksheetFormatting(ws, sheetRows, headerRowIndexes);
  XLSX.utils.book_append_sheet(wb, ws, "Ürün Yönetimi");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function setWorksheetFormatting(ws: XLSX.WorkSheet, rows: (string | number)[][], headerRowIndexes: Set<number>) {
  const colWidths: number[] = [];

  rows.forEach((r, rowIdx) => {
    const isHeader = headerRowIndexes.has(rowIdx);

    r.forEach((val, colIdx) => {
      const strVal = String(val ?? "");
      colWidths[colIdx] = Math.max(colWidths[colIdx] || 0, strVal.length);

      const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
      if (ws[cellRef]) {
        let fontColor = { rgb: isHeader ? "FFFFFF" : "111827" };
        let fillColor = isHeader ? { fgColor: { rgb: "0891B2" } } : undefined;
        let isBold = isHeader;

        const trimmedVal = strVal.trim();
        if (!isHeader) {
          if (trimmedVal === "Stok Girişi" || trimmedVal === "Giriş") {
            fillColor = { fgColor: { rgb: "C6EFCE" } }; // Good Fill
            fontColor = { rgb: "006100" }; // Good Text
            isBold = true;
          } else if (trimmedVal === "Stok Çıkışı" || trimmedVal === "Çıkış") {
            fillColor = { fgColor: { rgb: "FFC7CE" } }; // Bad Fill
            fontColor = { rgb: "9C0006" }; // Bad Text
            isBold = true;
          } else if (trimmedVal === "Transfer") {
            fillColor = { fgColor: { rgb: "FFEB9C" } }; // Neutral Fill
            fontColor = { rgb: "9C6500" }; // Neutral Text
            isBold = true;
          }
        }

        ws[cellRef].s = {
          font: {
            bold: isBold,
            name: "Calibri",
            sz: isHeader ? 13 : 11,
            color: fontColor,
          },
          fill: fillColor,
          border: {
            top: { style: "thin", color: { rgb: "D1D5DB" } },
            bottom: { style: "thin", color: { rgb: "D1D5DB" } },
            left: { style: "thin", color: { rgb: "D1D5DB" } },
            right: { style: "thin", color: { rgb: "D1D5DB" } },
          },
          alignment: {
            vertical: "center",
            horizontal: "center",
          },
        };
      }
    });
  });

  ws["!cols"] = colWidths.map((w) => ({ wch: Math.min(Math.max(w + 5, 14), 80) }));
}
