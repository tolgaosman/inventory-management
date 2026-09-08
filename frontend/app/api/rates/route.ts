import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

// Cache the rates for 1 hour
export const revalidate = 3600;

export async function GET() {
  try {
    const res = await fetch("https://www.kktcmerkezbankasi.org/veriler/doviz_kurlari/kur_sorgulama", {
      next: { revalidate: 3600 },
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch exchange rates: ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const rates: Record<string, number> = {
      try: 1, // Base currency
    };

    const rows = $(".cbdoviz tbody tr");
    rows.each((i, el) => {
      const tds = $(el).find("td");
      if (tds.length >= 3) {
        const currencyText = $(tds[0]).text().trim().toLowerCase();
        let currency = "";
        if (currencyText.includes("(usd)")) currency = "usd";
        else if (currencyText.includes("(eur)")) currency = "eur";
        else if (currencyText.includes("(gbp)")) currency = "gbp";

        if (currency) {
          // Using Döviz Satış (Selling Rate)
          const sellRateStr = $(tds[2]).text().trim();
          const sellRate = parseFloat(sellRateStr);
          if (!isNaN(sellRate)) {
            rates[currency] = sellRate;
          }
        }
      }
    });

    // If scraping fails to find the currencies, fallback to static defaults
    if (!rates.usd) rates.usd = 47.7118;
    if (!rates.eur) rates.eur = 55.1414;
    if (!rates.gbp) rates.gbp = 64.5136;

    return NextResponse.json(
      {
        success: true,
        data: rates,
        updatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("Exchange rate fetch error:", error);
    // Return fallback rates if something goes wrong
    return NextResponse.json(
      {
        success: false,
        data: {
          try: 1,
          usd: 47.7118,
          eur: 55.1414,
          gbp: 64.5136,
        },
        error: error instanceof Error ? error.message : "Failed to fetch rates",
      },
      { status: 500 }
    );
  }
}
