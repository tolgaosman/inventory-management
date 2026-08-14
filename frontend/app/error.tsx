"use client";

import { useEffect } from "react";
import { AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      {/* Same chip shape and title scale as the in-app state panels, so a
          full-page failure still reads as this product. */}
      <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <AlertOctagon className="size-5" />
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Bir şeyler ters gitti</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Beklenmedik bir hata oluştu. Sorun devam ederse yöneticinizle iletişime geçin.
        </p>
      </div>
      <Button onClick={reset}>Tekrar dene</Button>
    </div>
  );
}
