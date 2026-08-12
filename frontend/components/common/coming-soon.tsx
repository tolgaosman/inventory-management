import { Construction } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} />
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-muted/30 px-6 py-16 text-center">
        <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Construction className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Bu modül hazırlanıyor</p>
          <p className="text-sm text-muted-foreground">{title} yakında kullanıma açılacak.</p>
        </div>
      </div>
    </div>
  );
}
