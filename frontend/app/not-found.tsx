import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <PackageSearch className="size-5" />
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sayfa bulunamadı</h1>
        <p className="text-sm text-muted-foreground">Aradığınız sayfa taşınmış veya hiç var olmamış olabilir.</p>
      </div>
      <Button render={<Link href="/panel" />} nativeButton={false}>
        Panele dön
      </Button>
    </div>
  );
}
