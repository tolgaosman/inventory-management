import { getPurchaseOrder } from "@/lib/api/purchase-orders";
import type { CompanySettings } from "@/lib/settings-context";
import { buildInvoicePdf } from "./invoice-pdf";
import { downloadBlob, reportFilename, slugify } from "./download";

export async function downloadInvoicePdf(id: string, company: CompanySettings, approverName: string, language: "tr" | "en" = "tr"): Promise<string> {
  const order = await getPurchaseOrder(id);
  const blob = await buildInvoicePdf({ order, company, approverName, language });
  downloadBlob(blob, reportFilename("pdf", new Date(), `fatura-${slugify(order.code)}`));
  return order.code;
}
