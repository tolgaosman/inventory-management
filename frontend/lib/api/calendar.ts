import type { StockMovement } from "@/lib/types";
import type { PurchaseOrderRow } from "./purchase-orders";
import { apiFetch } from "./client";

export interface CalendarData {
  movements: StockMovement[];
  purchaseOrders: PurchaseOrderRow[];
}

/** Pass an ISO date range so the server scopes both feeds instead of shipping the whole history. */
export async function getCalendarData(from?: string, to?: string): Promise<CalendarData> {
  return apiFetch<CalendarData>("/calendar", { query: { from, to } });
}
