/**
 * Triggers a browser download for a generated file.
 *
 * Uses an object URL rather than a `data:` URI — a full report easily exceeds
 * the length limit browsers impose on data URIs.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Turns a Turkish label into a filename-safe slug: "Kritik Stok Listesi" -> "kritik-stok-listesi". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/** `near-east-technology-stok-raporu-2026-08-10.csv` (pass `prefix` to replace "stok-raporu"). */
export function reportFilename(
  extension: "csv" | "pdf" | "xlsx",
  date = new Date(),
  prefix = "stok-raporu",
): string {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  return `near-east-technology-${prefix}-${stamp}.${extension}`;
}
