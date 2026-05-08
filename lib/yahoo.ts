import YahooFinance from "yahoo-finance2";
import type { StockQuote } from "@/types/stock";

const yahooFinance = new YahooFinance();

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

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown Yahoo Finance error";
}

export async function getStockLookup(ticker: string): Promise<StockLookup | null> {
  try {
    const quote = (await yahooFinance.quote(
      normalizeTicker(ticker),
    )) as YahooQuoteResult;
    return {
      ticker: normalizeTicker(ticker),
      name: (quote.shortName ?? quote.longName ?? normalizeTicker(ticker)) as string,
      market: (quote.fullExchangeName ?? quote.exchange ?? "Unknown") as string,
    };
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

export async function getStockQuote(ticker: string): Promise<StockQuote | null> {
  try {
    const normalizedTicker = normalizeTicker(ticker);
    const quote = (await yahooFinance.quote(normalizedTicker)) as YahooQuoteResult;

    return {
      symbol: normalizedTicker,
      shortName: quote.shortName ?? quote.longName ?? normalizedTicker,
      currency: quote.currency ?? "USD",
      marketPrice: quote.regularMarketPrice ?? null,
      marketChange: quote.regularMarketChange ?? null,
      marketChangePercent: quote.regularMarketChangePercent ?? null,
    };
  } catch {
    return null;
  }
}

export async function getStockDashboardQuote(ticker: string) {
  const quote = await getStockQuote(ticker);

  if (!quote) {
    return {
      quote: null,
      quoteError: "시세를 불러오지 못했습니다.",
    };
  }

  return {
    quote,
    quoteError: null,
  };
}
