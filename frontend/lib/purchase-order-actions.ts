import type { PurchaseOrderStatus } from "@/lib/types";

/**
 * The minimal shape both the list row and the full detail view can produce —
 * neither needs to hand over its whole item array just to answer "can this
 * be edited".
 */
export interface PurchaseOrderActionInput {
  status: PurchaseOrderStatus;
  /** True if any line item has `receivedQuantity > 0`. */
  hasReceivedProgress: boolean;
}

export interface PurchaseOrderActions {
  canMarkOrdered: boolean;
  /** Submit a draft for internal approval before it's sent to the supplier. */
  canRequestApproval: boolean;
  /** Approve a "pending_approval" order, moving it straight to "ordered". */
  canApprove: boolean;
  /** Reject a "pending_approval" order, sending it back to "draft" for rework. */
  canReject: boolean;
  canEdit: boolean;
  canReceive: boolean;
  canCancel: boolean;
  canDelete: boolean;
}

/**
 * Single source of truth for which actions a purchase order's current state
 * allows. Used by both the list row menu and the detail page header so the
 * two can never drift apart — the API enforces the same rules server-side
 * and throws `CONFLICT` if the UI ever gets this wrong.
 */
export function getAvailableActions(po: PurchaseOrderActionInput): PurchaseOrderActions {
  return {
    canMarkOrdered: po.status === "draft",
    canRequestApproval: po.status === "draft",
    canApprove: po.status === "pending_approval",
    canReject: po.status === "pending_approval",
    canEdit:
      po.status === "draft" ||
      po.status === "pending_approval" ||
      (po.status === "ordered" && !po.hasReceivedProgress),
    canReceive: po.status === "ordered" || po.status === "partially_received",
    canCancel: po.status !== "received" && po.status !== "cancelled",
    canDelete: po.status === "draft",
  };
}

export type PerformanceTone = "good" | "warning" | "critical" | "neutral";

/**
 * Colour a performance percentage (on-time rate, fill rate) by how healthy
 * it is. `null` means "no completed orders yet" — a genuinely different
 * state from a bad score, so it gets its own neutral tone rather than
 * reading as 0%.
 */
export function performanceTone(percent: number | null): PerformanceTone {
  if (percent === null) return "neutral";
  if (percent >= 85) return "good";
  if (percent >= 60) return "warning";
  return "critical";
}

export function performanceTextClass(percent: number | null): string {
  const tone = performanceTone(percent);
  return tone === "good"
    ? "text-status-good"
    : tone === "warning"
      ? "text-status-warning-foreground"
      : tone === "critical"
        ? "text-status-critical"
        : "text-muted-foreground";
}
