// Shared by the quote-request form sheet (download right after creating) and
// the Teklifler tab's "PDF İndir" row action, so both paths build the exact
// same document the exact same way.
import { getQuoteRequest } from "@/lib/api/quotes";
import type { CompanySettings } from "@/lib/settings-context";
import { buildQuoteRequestPdf } from "./quote-pdf";
import { downloadBlob, reportFilename, slugify } from "./download";

export async function downloadQuoteRequestPdf(id: string, company: CompanySettings, approverName?: string, language: "tr" | "en" = "tr"): Promise<string> {
  const quote = await getQuoteRequest(id);
  const blob = await buildQuoteRequestPdf({ quote, company, language, approverName });
  downloadBlob(blob, reportFilename("pdf", new Date(), `teklif-istegi-${slugify(quote.code)}`));
  return quote.code;
}
