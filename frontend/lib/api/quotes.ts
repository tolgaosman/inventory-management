// Teklif İstekleri (RFQ) — bundles one or more of a supplier's not-yet-sent
// purchase orders into a single quote-request document. Mirrors the shape and
// conventions of lib/api/purchase-orders.ts.
import type { PagedQuery, PagedResult, Product, QuoteCurrency, QuoteRequest, Supplier } from "@/lib/types";
import { apiFetch } from "./client";

export type QuoteRequestRow = QuoteRequest & {
  supplierName: string;
  orderCount: number;
  itemCount: number;
  total: number;
};

export type QuoteRequestQuery = PagedQuery & {
  supplierId?: string;
};

export async function listQuoteRequests(
  query: QuoteRequestQuery = {},
): Promise<PagedResult<QuoteRequestRow>> {
  return apiFetch<PagedResult<QuoteRequestRow>>("/quote-requests", {
    query: {
      supplierId: query.supplierId,
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
    },
  });
}

export type QuoteRequestDetail = QuoteRequestRow & {
  supplier: Supplier;
  orders: {
    id: string;
    code: string;
    expectedAt: string;
    warehouseName: string;
    items: { productId: string; quantity: number; unitPrice: number; product: Product }[];
  }[];
};

export async function getQuoteRequest(id: string): Promise<QuoteRequestDetail> {
  return apiFetch<QuoteRequestDetail>(`/quote-requests/${id}`);
}

export interface CreateQuoteRequestInput {
  purchaseOrderIds: string[];
  validUntil: string;
  deliveryDate: string;
  deliveryAddress: string;
  paymentTerms: string;
  requestedCurrency: QuoteCurrency;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes?: string;
  /** Ignored by the server — the creator comes from the auth token. */
  createdBy?: string;
}

export async function createQuoteRequest(input: CreateQuoteRequestInput): Promise<QuoteRequest> {
  return apiFetch<QuoteRequest>("/quote-requests", { method: "POST", body: input });
}

/** For the supplier-selection dialog: quotable (draft or pending-approval) orders grouped by supplier, with totals for display. */
export interface DraftOrderOption {
  id: string;
  code: string;
  supplierId: string;
  status: "draft" | "pending_approval";
  itemCount: number;
  total: number;
  expectedAt: string;
}

export async function listDraftOrdersBySupplier(): Promise<Record<string, DraftOrderOption[]>> {
  return apiFetch<Record<string, DraftOrderOption[]>>("/purchase-orders/quotable-grouped");
}

export type QuoteOrInvoiceRow =
  | (QuoteRequestRow & { type: "quote" })
  | {
      type: "invoice";
      id: string;
      code: string;
      supplierName: string;
      orderCount: number;
      itemCount: number;
      createdAt: string;
      validUntil: string;
      createdBy: string;
      total: number;
    };

export async function listQuotesAndInvoices(
  query: QuoteRequestQuery = {},
): Promise<PagedResult<QuoteOrInvoiceRow>> {
  return apiFetch<PagedResult<QuoteOrInvoiceRow>>("/quotes-and-invoices", {
    query: {
      supplierId: query.supplierId,
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
    },
  });
}
