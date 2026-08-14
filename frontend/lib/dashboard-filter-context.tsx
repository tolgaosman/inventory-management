"use client";

import { createContext, useContext, useState } from "react";
import type { DateRangePreset } from "@/lib/api/dashboard";
import { useSettings } from "@/lib/settings-context";

interface DashboardFilterContextValue {
  range: DateRangePreset;
  setRange: (range: DateRangePreset) => void;
  warehouseId: string | undefined;
  setWarehouseId: (warehouseId: string | undefined) => void;
}

const DashboardFilterContext = createContext<DashboardFilterContextValue | null>(null);

export function DashboardFilterProvider({ children }: { children: React.ReactNode }) {
  const { defaultRange } = useSettings();
  const [range, setRange] = useState<DateRangePreset>(defaultRange);
  const [warehouseId, setWarehouseId] = useState<string | undefined>(undefined);

  return (
    <DashboardFilterContext.Provider value={{ range, setRange, warehouseId, setWarehouseId }}>
      {children}
    </DashboardFilterContext.Provider>
  );
}

export function useDashboardFilter() {
  const context = useContext(DashboardFilterContext);
  if (!context) {
    throw new Error("useDashboardFilter must be used within a DashboardFilterProvider");
  }
  return context;
}
