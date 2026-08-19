// xlsx-js-style (not plain xlsx) is required here for cell-level styling
// (colors/borders/fonts below) — the vanilla SheetJS Community Edition drops
// styles on write. Safe to keep despite carrying an unpatched CVE-affected
// parser: this file only ever writes data the app generated itself, it never
// parses untrusted input. User-uploaded files are parsed in
// product-import-modal.tsx, which uses the patched `xlsx` package instead.
import * as XLSX from "xlsx-js-style";
import type { ReportData } from "./report-data";
import { CURRENCY_SYMBOLS, matchSectionId } from "./report-data";

export function buildReportExcel(data: ReportData, selectedSections: string[] = ["all"]): Blob {
  const wb = XLSX.utils.book_new();
  const includeAll = selectedSections.includes("all");

  const targetSections = includeAll
    ? data.sections
    : data.sections.filter((s) => selectedSections.some((id) => matchSectionId(s.title, id)));

  const sheetRows: (string | number)[][] = [];
  const headerRowIndexes = new Set<number>();
  const currencyCellMap = new Set<string>();

  for (const section of targetSections) {
    if (section.rows.length === 0) continue;
    if (sheetRows.length > 0) sheetRows.push([]); // Gap between sections if multiple
    
    headerRowIndexes.add(sheetRows.length);
    sheetRows.push(section.columns);

    const startRowIdx = sheetRows.length;
    for (const r of section.rows) {
      sheetRows.push(r);
    }
    const endRowIdx = sheetRows.length - 1;

    if (section.currencyColumns && section.currencyColumns.length > 0) {
      for (let rIdx = startRowIdx; rIdx <= endRowIdx; rIdx++) {
        for (const cIdx of section.currencyColumns) {
          currencyCellMap.add(`${rIdx},${cIdx}`);
        }
      }
    }
  }

  // Fallback if no sections
  if (sheetRows.length === 0) {
    sheetRows.push(["Bilgi"]);
    sheetRows.push(["Gösterilecek veri bulunamadı."]);
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  setWorksheetFormatting(ws, sheetRows, headerRowIndexes, currencyCellMap, data.currency);
  XLSX.utils.book_append_sheet(wb, ws, "Ürün Yönetimi");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function setWorksheetFormatting(
  ws: XLSX.WorkSheet,
  rows: (string | number)[][],
  headerRowIndexes: Set<number>,
  currencyCellMap: Set<string>,
  currencyCode: string,
) {
  const symbol = CURRENCY_SYMBOLS[currencyCode?.toLowerCase() as keyof typeof CURRENCY_SYMBOLS] || "₺";
  const numFmt = `"${symbol}"#,##0;("${symbol}"#,##0);"-"`;
  const colWidths: number[] = [];

  rows.forEach((r, rowIdx) => {
    if (r.length === 0) return;
    const isHeader = headerRowIndexes.has(rowIdx);

    r.forEach((val, colIdx) => {
      const isCurrency = !isHeader && currencyCellMap.has(`${rowIdx},${colIdx}`) && typeof val === "number";
      const strVal = isCurrency ? `${symbol} ${val}` : String(val ?? "");
      colWidths[colIdx] = Math.max(colWidths[colIdx] || 0, strVal.length);

      const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
      if (!ws[cellRef]) {
        ws[cellRef] = { t: typeof val === "number" ? "n" : "s", v: val };
      }

      let fontColor = { rgb: isHeader ? "FFFFFF" : "111827" };
      let fillColor = isHeader ? { fgColor: { rgb: "0891B2" } } : undefined;
      let isBold = isHeader;

      const trimmedVal = strVal.trim();
      const lowerVal = trimmedVal.toLowerCase();
      if (!isHeader) {
        if (trimmedVal === "Stok Girişi" || trimmedVal === "Giriş" || lowerVal === "aktif" || trimmedVal === "Teslim Alındı") {
          fillColor = { fgColor: { rgb: "C6EFCE" } }; // Good Fill (#C6EFCE)
          fontColor = { rgb: "006100" }; // Good Text (#006100)
          isBold = true;
        } else if (trimmedVal === "Stok Çıkışı" || trimmedVal === "Çıkış" || lowerVal === "pasif" || trimmedVal === "İptal Edildi") {
          fillColor = { fgColor: { rgb: "FFC7CE" } }; // Bad Fill (#FFC7CE)
          fontColor = { rgb: "9C0006" }; // Bad Text (#9C0006)
          isBold = true;
        } else if (trimmedVal === "Transfer" || trimmedVal === "Kısmen Teslim Alındı") {
          fillColor = { fgColor: { rgb: "FFEB9C" } }; // Neutral Fill (#FFEB9C)
          fontColor = { rgb: "9C6500" }; // Neutral Text (#9C6500)
          isBold = true;
        } else if (trimmedVal === "Sipariş Edildi") {
          fillColor = { fgColor: { rgb: "B4C6E7" } }; // 60% Accent 5
          fontColor = { rgb: "1F497D" }; // Dark Blue, Text 2, Darker 50%
          isBold = true;
        } else if (trimmedVal === "Taslak") {
          fillColor = { fgColor: { rgb: "F2F2F2" } }; // Output Fill
          fontColor = { rgb: "3F3F3F" }; // Output Text
          isBold = true;
        } else if (trimmedVal === "Onay Bekliyor") {
          fillColor = { fgColor: { rgb: "FCE0A5" } }; // Amber Fill
          fontColor = { rgb: "925B04" }; // Amber Text
          isBold = true;
        }
      }

      ws[cellRef].s = {
        font: {
          bold: isBold,
          name: "Calibri",
          sz: isHeader ? 12 : 10,
          color: fontColor,
        },
        fill: fillColor,
        border: {
          top: { style: "thin", color: { rgb: "6B7280" } },
          bottom: { style: "thin", color: { rgb: "6B7280" } },
          left: { style: "thin", color: { rgb: "6B7280" } },
          right: { style: "thin", color: { rgb: "6B7280" } },
        },
        alignment: {
          vertical: "center",
          horizontal: "center",
          wrapText: true,
        },
        ...(isCurrency ? { numFmt } : {}),
      };
      if (isCurrency) {
        ws[cellRef].z = numFmt;
      }
    });
  });

  ws["!cols"] = colWidths.map((w) => ({ wch: Math.min(Math.max(w + 5, 14), 80) }));
}
