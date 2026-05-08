import yahooFinance from "yahoo-finance2";
import type { StockQuote } from "@/types/stock";

export type StockLookup = {
  ticker: string;
  name: string;
  market: string;
};

type YahooQuoteResult = {
  currency?: string;
  exchange?: string;
  fullExchangeName?: string;
  longName?: string;
  quoteType?: string;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketPrice?: number;
  shortName?: string;
  symbol?: string;
};

function normalizeTicker(ticker: string) {
  return ticker.trim().toUpperCase();
}

export async function getStockLookup(ticker: string): Promise<StockLookup | null> {
  try {
    const quote = (await yahooFinance.quote(
      normalizeTicker(ticker),
    )) as YahooQuoteResult;

    if (!quote.symbol) {
      return null;
    }

    return {
      ticker: quote.symbol,
      name: quote.shortName ?? quote.longName ?? quote.symbol,
      market: quote.fullExchangeName ?? quote.exchange ?? quote.quoteType ?? "Unknown",
    };
  } catch {
    return null;
  }
}

export async function getStockQuote(ticker: string): Promise<StockQuote | null> {
  try {
    const quote = (await yahooFinance.quote(
      normalizeTicker(ticker),
    )) as YahooQuoteResult;

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
  } catch {
    return null;
  }
}
