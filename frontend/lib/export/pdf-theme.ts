// Shared jsPDF setup — palette, layout constants and the Roboto-embedding
// bootstrap — so every PDF builder (report, quote request, …) looks like one
// family of documents instead of drifting per file.
//
// jsPDF, autoTable and the embedded font are all pulled in with dynamic
// imports so none of them reach the initial bundle — they load only when the
// user actually asks for a PDF.

/** Palette lifted from logo & branding (Turquoise, Sapphire Blue, Emerald). */
export const COLORS = {
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

export const MARGIN = 40;
export const HEADER_HEIGHT = 74;
export const FOOTER_HEIGHT = 30;
export const FONT = "Roboto";

export type Doc = import("jspdf").jsPDF;

/** Fetches the site logo and embeds it as a data URL, along with its natural pixel size so callers can scale it without distortion. Returns `null` if the fetch/decode fails, so callers can fall back to a text-only header. */
export async function loadBrandLogo(): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const { default: browserLogo } = await import("@/assets/browserLogo.png");
    const res = await fetch(browserLogo.src);
    const blob = await res.blob();
    const rawDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = rawDataUrl;
    });

    // Re-encode through a canvas at the image's own natural size: jsPDF's PNG
    // decoder has trouble with some source files (notably ones exported with
    // interlacing or unusual chunk ordering) and silently renders only part
    // of the image. A canvas round-trip always produces a plain, single-pass
    // PNG that jsPDF embeds intact.
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { dataUrl: rawDataUrl, width: img.naturalWidth, height: img.naturalHeight };
    ctx.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");

    return { dataUrl, width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return null;
  }
}

export function accentColor(accent: string | undefined): [number, number, number] {
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

/** Creates an A4 jsPDF document (portrait by default) with the Roboto font (incl. Turkish glyphs) embedded and selected. */
export async function createPdfDoc(
  orientation: "portrait" | "landscape" = "portrait",
): Promise<{ doc: Doc; autoTable: typeof import("jspdf-autotable").autoTable }> {
  const [{ jsPDF }, { autoTable }, fonts] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("./fonts/roboto"),
  ]);

  const doc = new jsPDF({ orientation, unit: "pt", format: "a4", compress: true });

  doc.addFileToVFS("Roboto-Regular.ttf", fonts.ROBOTO_REGULAR_BASE64);
  doc.addFont("Roboto-Regular.ttf", FONT, "normal");
  doc.addFileToVFS("Roboto-Bold.ttf", fonts.ROBOTO_BOLD_BASE64);
  doc.addFont("Roboto-Bold.ttf", FONT, "bold");
  doc.setFont(FONT, "normal");

  return { doc, autoTable };
}

/** Footer band repeated on every page: `left · title` on the left, `Sayfa X / Y` on the right. */
export function drawFooter(doc: Doc, footerLeft: string, pageNumber: number, pageCount: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const y = pageHeight - 18;

  doc.setDrawColor(...COLORS.grid);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y - 12, pageWidth - MARGIN, y - 12);

  doc.setFont(FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text(footerLeft, MARGIN, y);
  doc.text(`Sayfa ${pageNumber} / ${pageCount}`, pageWidth - MARGIN, y, { align: "right" });
}

/** Section heading: a coloured vertical bar plus bold label. */
export function drawSectionTitle(doc: Doc, title: string, y: number): number {
  doc.setFillColor(...COLORS.brand);
  doc.rect(MARGIN, y - 9, 3.5, 12, "F");

  doc.setFont(FONT, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.brandDark);
  doc.text(title, MARGIN + 10, y);
  return y + 8;
}
