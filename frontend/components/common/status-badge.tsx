import { AlertTriangle, ArrowDownRight, ArrowLeftRight, ArrowUpRight, CheckCircle2, CircleDot, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MovementType, ProductStatus, PurchaseOrderStatus } from "@/lib/types";
import { MOVEMENT_TYPE_LABELS, PRODUCT_STATUS_LABELS, PURCHASE_STATUS_LABELS } from "@/lib/constants";

const badgeBase =
  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap";

export function StockStatusBadge({ level }: { level: "kritik" | "dusuk" | "normal" }) {
  const map = {
    kritik: { label: "Kritik", cls: "bg-status-critical/10 text-status-critical", Icon: AlertTriangle },
    dusuk: { label: "Düşük", cls: "bg-status-warning/12 text-status-warning-foreground", Icon: Clock },
    normal: { label: "Normal", cls: "bg-status-good/10 text-status-good", Icon: CheckCircle2 },
  } as const;
  const { label, cls, Icon } = map[level];
  return (
    <span className={cn(badgeBase, cls)}>
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return (
    <span
      className={cn(
        badgeBase,
        status === "aktif" ? "bg-status-good/10 text-status-good" : "bg-muted text-muted-foreground",
      )}
    >
      <CircleDot className="size-3.5" />
      {PRODUCT_STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Movement types are a neutral taxonomy, not a health signal — they use
 * foreground/primary tints rather than the status palette so they never read
 * as "something is wrong".
 */
export function MovementTypeBadge({ type }: { type: MovementType }) {
  const map = {
    giris: { cls: "bg-status-good/10 text-status-good", Icon: ArrowUpRight },
    cikis: { cls: "bg-muted text-foreground", Icon: ArrowDownRight },
    transfer: { cls: "bg-accent text-accent-foreground", Icon: ArrowLeftRight },
  } as const;
  const { cls, Icon } = map[type];
  return (
    <span className={cn(badgeBase, cls)}>
      <Icon className="size-3.5" />
      {MOVEMENT_TYPE_LABELS[type]}
    </span>
  );
}

export function PurchaseStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const map: Record<PurchaseOrderStatus, { cls: string; Icon: typeof CheckCircle2 }> = {
    draft: { cls: "bg-muted text-muted-foreground", Icon: CircleDot },
    ordered: { cls: "bg-primary/10 text-primary", Icon: Clock },
    partially_received: { cls: "bg-status-warning/12 text-status-warning-foreground", Icon: Clock },
    received: { cls: "bg-status-good/10 text-status-good", Icon: CheckCircle2 },
    cancelled: { cls: "bg-status-critical/10 text-status-critical", Icon: XCircle },
  };
  const { cls, Icon } = map[status];
  return (
    <span className={cn(badgeBase, cls)}>
      <Icon className="size-3.5" />
      {PURCHASE_STATUS_LABELS[status]}
    </span>
  );
}
