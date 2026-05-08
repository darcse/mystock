import yahooFinance from "yahoo-finance2";
import type { StockQuote } from "@/types/stock";

export async function getStockQuote(ticker: string): Promise<StockQuote | null> {
  const quote = (await yahooFinance.quote(ticker)) as {
    symbol?: string;
    shortName?: string;
    longName?: string;
    currency?: string;
    regularMarketPrice?: number;
    regularMarketChange?: number;
    regularMarketChangePercent?: number;
  };

  if (!quote.symbol) {
    return null;
  }

  return {
    symbol: quote.symbol,
    shortName: quote.shortName ?? quote.longName ?? quote.symbol,
    currency: quote.currency ?? "USD",
    marketPrice: quote.regularMarketPrice ?? null,
    marketChange: quote.regularMarketChange ?? null,
    marketChangePercent: quote.regularMarketChangePercent ?? null,
  };
}
