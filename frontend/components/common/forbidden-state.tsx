import { ShieldAlert } from "lucide-react";

export function ForbiddenState({
  message = "Bu sayfayı görüntülemek için yetkiniz yok.",
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/30 px-6 py-20 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ShieldAlert className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Yetkisiz İşlem</p>
        <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
      </div>
    </div>
  );
}
