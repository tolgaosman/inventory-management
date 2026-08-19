import { Suspense } from "react";
import { MovementHistoryClient } from "@/components/stock/movement-history-client";

export default function StockMovementsPage() {
  return (
    <Suspense fallback={null}>
      <MovementHistoryClient />
    </Suspense>
  );
}
