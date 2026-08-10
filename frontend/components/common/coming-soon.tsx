import { Construction } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} />
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/30 px-6 py-24 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Construction className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Bu sayfa üzerinde çalışılıyor</p>
          <p className="text-sm text-muted-foreground">{title} yakında burada olacak.</p>
        </div>
      </div>
    </div>
  );
}
