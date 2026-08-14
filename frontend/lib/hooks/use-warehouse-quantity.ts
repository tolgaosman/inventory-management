"use client";

import { useEffect, useState } from "react";
import { getStockQuantity } from "@/lib/api/movements";

/** Live "mevcut miktar" for the currently selected warehouse, refetched whenever it changes. */
export function useWarehouseQuantity(productId: string | undefined, warehouseId: string) {
  const [quantity, setQuantity] = useState<number | null>(null);

  useEffect(() => {
    if (!productId || !warehouseId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuantity(null);
      return;
    }
    let cancelled = false;
    getStockQuantity(productId, warehouseId).then((qty) => {
      if (!cancelled) setQuantity(qty);
    });
    return () => {
      cancelled = true;
    };
  }, [productId, warehouseId]);

  return quantity;
}
