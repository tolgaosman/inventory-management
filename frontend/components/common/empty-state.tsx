import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/common/state-panel";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <StatePanel
      icon={Icon}
      title={title}
      description={description}
      className={className}
      action={
        actionLabel && onAction ? (
          <Button size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null
      }
    />
  );
}
