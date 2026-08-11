"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

export type CurrencyCode = "try" | "usd" | "eur" | "gbp";

export interface ExchangeRates {
  try: number;
  usd: number;
  eur: number;
  gbp: number;
}

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  rates: ExchangeRates | null;
  isLoading: boolean;
  lastUpdated: string | null;
  refreshRates: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = "inventory_currency_preference";

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("try");
  const [rates, setRates] = useState<ExchangeRates | null>({
    try: 1,
    usd: 47.7118,
    eur: 55.1414,
    gbp: 64.5136,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Initialize currency from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY) as CurrencyCode;
      if (saved && ["try", "usd", "eur", "gbp"].includes(saved)) {
        setCurrencyState(saved);
      }
    }
  }, []);

  const setCurrency = (c: CurrencyCode) => {
    setCurrencyState(c);
    localStorage.setItem(LOCAL_STORAGE_KEY, c);
  };

  const refreshRates = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/rates");
      const json = await res.json();
      if (json.success && json.data) {
        setRates(json.data);
        if (json.updatedAt) {
          setLastUpdated(json.updatedAt);
        }
      } else {
        throw new Error(json.error || "Failed to fetch rates");
      }
    } catch (error) {
      console.error("Failed to load exchange rates:", error);
      toast.error("Kurlar güncellenemedi", {
        description: "KKTC Merkez Bankası kurları çekilirken bir hata oluştu.",
      });
      // Fallback rates
      setRates({
        try: 1,
        usd: 47.7118,
        eur: 55.1414,
        gbp: 64.5136,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch rates on mount
  useEffect(() => {
    refreshRates();
  }, []);

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, rates, isLoading, lastUpdated, refreshRates }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
