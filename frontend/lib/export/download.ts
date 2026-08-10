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

/** `near-east-technology-stok-raporu-2026-08-10.csv` */
export function reportFilename(extension: "csv" | "pdf" | "xlsx", date = new Date()): string {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  return `near-east-technology-stok-raporu-${stamp}.${extension}`;
}
