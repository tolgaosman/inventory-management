import { AlertTriangle, ArrowDownRight, ArrowLeftRight, ArrowUpRight, CheckCircle2, CircleDot, Clock, Hourglass, XCircle, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
 * Movement types are a neutral taxonomy, not a health signal, so they don't
 * use the status palette — but each still gets its own tone from the accent
 * family so the three types stay visually distinct in a movement list.
 */
export function MovementTypeBadge({ type }: { type: MovementType }) {
  const map = {
    giris: { cls: "bg-tint-green/10 text-tint-green", Icon: ArrowUpRight },
    cikis: { cls: "bg-tint-amber/12 text-tint-amber", Icon: ArrowDownRight },
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

export function PurchaseStatusBadge({ status, rejectionReason }: { status: PurchaseOrderStatus; rejectionReason?: string }) {
  const map: Record<PurchaseOrderStatus, { cls: string; Icon: typeof CheckCircle2 }> = {
    draft: { cls: "bg-muted text-muted-foreground", Icon: CircleDot },
    pending_approval: { cls: "bg-tint-amber/12 text-tint-amber", Icon: Hourglass },
    ordered: { cls: "bg-primary/10 text-primary", Icon: Clock },
    partially_received: { cls: "bg-status-warning/12 text-status-warning-foreground", Icon: Clock },
    received: { cls: "bg-status-good/10 text-status-good", Icon: CheckCircle2 },
    cancelled: { cls: "bg-status-critical/10 text-status-critical", Icon: XCircle },
  };
  const { cls, Icon } = map[status];

  const badge = (
    <span className={cn(badgeBase, cls)}>
      <Icon className="size-3.5" />
      {PURCHASE_STATUS_LABELS[status]}
    </span>
  );

  if (status === "cancelled" && rejectionReason) {
    return (
      <TooltipProvider delay={100}>
        <div className="flex items-center gap-1.5">
          {badge}
          <Tooltip>
            <TooltipTrigger className="text-status-critical hover:text-status-critical/80 transition-colors">
              <Info className="size-4" />
              <span className="sr-only">İptal/Red Gerekçesi</span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-[200px] text-xs leading-relaxed">{rejectionReason}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  return badge;
}
