import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductsClient } from "@/components/products/products-client";

function ProductsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductsSkeleton />}>
      <ProductsClient />
    </Suspense>
  );
}
