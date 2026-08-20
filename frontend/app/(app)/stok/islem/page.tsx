import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CombinedMovementPage } from "@/components/stock/combined-movement-page";

export const metadata = {
  title: "Giriş / Çıkış / Transfer | Stok Yönetim Sistemi",
  description: "Deponuza yeni giren, çıkan ve transfer edilen stok hareketlerini tek ekrandan yönetin.",
};

function CombinedMovementSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

export default function StockCombinedPage() {
  return (
    <Suspense fallback={<CombinedMovementSkeleton />}>
      <CombinedMovementPage />
    </Suspense>
  );
}
