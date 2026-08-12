import { ShieldAlert } from "lucide-react";

export function ForbiddenState({
  message = "Bu sayfayı görüntülemek için yetkiniz yok.",
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-muted/30 px-6 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <ShieldAlert className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Yetkisiz işlem</p>
        <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
      </div>
    </div>
  );
}
