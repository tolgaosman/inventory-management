// Teklif İstekleri (RFQ) — a quote request sent to a supplier (existing or a
// brand-new one, name-only) for a hand-picked list of items. Independent of
// purchase orders. Mirrors the shape and conventions of lib/api/purchase-orders.ts.
import type { PagedQuery, PagedResult, QuoteCurrency, QuoteRequest, QuoteRequestStatus, Supplier } from "@/lib/types";
import { apiFetch } from "./client";

export type QuoteRequestRow = QuoteRequest & {
  supplierName: string;
  itemCount: number;
  total: number;
};

export type QuoteRequestQuery = PagedQuery & {
  supplierId?: string;
  status?: QuoteRequestStatus;
  excludeStatus?: QuoteRequestStatus;
  createdBy?: string;
};

export async function listQuoteRequests(
  query: QuoteRequestQuery = {},
): Promise<PagedResult<QuoteRequestRow>> {
  return apiFetch<PagedResult<QuoteRequestRow>>("/quote-requests", {
    query: {
      supplierId: query.supplierId,
      status: query.status,
      excludeStatus: query.excludeStatus,
      created_by: query.createdBy,
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
    },
  });
}

export type QuoteRequestDetail = QuoteRequestRow & {
  supplier: Supplier | null;
};

export async function getQuoteRequest(id: string): Promise<QuoteRequestDetail> {
  return apiFetch<QuoteRequestDetail>(`/quote-requests/${id}`);
}

/** One requested line — an existing catalog product, or an ad-hoc product name + unit typed in by hand. */
export interface QuoteItemInput {
  productId?: string;
  productName?: string;
  unit?: string;
  quantity: number;
}

export interface CreateQuoteRequestInput {
  /** Exactly one of `supplierId` / `adhocSupplierName` must be set. */
  supplierId?: string;
  adhocSupplierName?: string;
  /** Required alongside `adhocSupplierName`. */
  adhocSupplierEmail?: string;
  items: QuoteItemInput[];
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

export async function approveQuoteRequest(id: string): Promise<QuoteRequest> {
  return apiFetch<QuoteRequest>(`/quote-requests/${id}/approve`, { method: "POST" });
}

export async function rejectQuoteRequest(id: string): Promise<QuoteRequest> {
  return apiFetch<QuoteRequest>(`/quote-requests/${id}/reject`, { method: "POST" });
}

export async function deleteQuoteRequest(id: string): Promise<boolean> {
  await apiFetch<{ deleted: boolean }>(`/quote-requests/${id}`, { method: "DELETE" });
  return true;
}

export async function restoreQuoteRequest(id: string): Promise<void> {
  await apiFetch<void>(`/quote-requests/${id}/restore`, { method: "POST" });
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
