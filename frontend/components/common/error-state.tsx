import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/common/state-panel";

export function ErrorState({
  title = "İşlem tamamlanamadı",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <StatePanel
      icon={AlertTriangle}
      tone="destructive"
      title={title}
      description={message}
      action={
        onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Tekrar dene
          </Button>
        ) : null
      }
    />
  );
}
