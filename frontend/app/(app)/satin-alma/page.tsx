import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PurchaseOrdersClient } from "@/components/purchase-orders/purchase-orders-client";

export const metadata = {
  title: "Satın Alma | Stok Yönetim Sistemi",
  description: "Tedarikçilerden gelen satın alma siparişlerini oluşturun, gönderin ve teslim alın.",
};

function PurchaseOrdersSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={<PurchaseOrdersSkeleton />}>
      <PurchaseOrdersClient />
    </Suspense>
  );
}
