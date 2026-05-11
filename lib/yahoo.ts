import YahooFinance from "yahoo-finance2";
import type { MarketIndexItem, StockChartPoint, StockQuote } from "@/types/stock";

const yahooFinance = new YahooFinance({
  suppressNotices: ["ripHistorical"],
});

export type StockLookup = {
  ticker: string;
  name: string;
  market: string;
};

export type StockSearchResult = {
  ticker: string;
  name: string;
  market: string;
};

type YahooQuoteResult = {
  currency?: string;
  exchange?: string;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  fullExchangeName?: string;
  longName?: string;
  quoteType?: string;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketPrice?: number;
  shortName?: string;
  symbol?: string;
};

const MARKET_INDEX_DEFINITIONS = [
  { symbol: "^KS11", label: "KOSPI" },
  { symbol: "^KQ11", label: "KOSDAQ" },
  { symbol: "^GSPC", label: "S&P500" },
  { symbol: "^IXIC", label: "NASDAQ" },
  { symbol: "KRW=X", label: "USD/KRW" },
] as const;

type YahooHistoricalResult = Array<{
  close?: number | null;
  date?: Date;
  high?: number | null;
  low?: number | null;
  open?: number | null;
  volume?: number | null;
}>;

type YahooChartResult = {
  quotes?: YahooHistoricalResult;
};

type YahooSearchResult = {
  quotes?: Array<{
    exchange?: string;
    longname?: string;
    quoteType?: string;
    shortname?: string;
    symbol?: string;
  }>;
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
    )) as YahooQuoteResult | null | undefined;

    if (!quote) {
      return null;
    }

    return {
      ticker: normalizeTicker(ticker),
      name: (quote.shortName ?? quote.longName ?? normalizeTicker(ticker)) as string,
      market: (quote.fullExchangeName ?? quote.exchange ?? "Unknown") as string,
    };
  } catch {
    return null;
  }
}

export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length < 1) {
    return [];
  }

  try {
    const result = (await yahooFinance.search(normalizedQuery)) as YahooSearchResult;
    const quotes = result.quotes ?? [];

    return quotes
      .filter((item) => item.symbol)
      .slice(0, 8)
      .map((item) => ({
        ticker: normalizeTicker(item.symbol ?? ""),
        name: (item.shortname ?? item.longname ?? item.symbol ?? "").trim(),
        market: (item.exchange ?? "Unknown").trim(),
      }))
      .filter((item) => item.ticker && item.name);
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
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? null,
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

function getPeriodStartDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date;
}

function getMovingAverage(values: number[], windowSize: number, currentIndex: number) {
  if (currentIndex + 1 < windowSize) {
    return null;
  }

  const window = values.slice(currentIndex + 1 - windowSize, currentIndex + 1);
  const total = window.reduce((sum, value) => sum + value, 0);
  return total / window.length;
}

export async function getStockChart(ticker: string): Promise<StockChartPoint[]> {
  const chart = (await yahooFinance.chart(normalizeTicker(ticker), {
    interval: "1d",
    period1: getPeriodStartDate(),
  })) as YahooChartResult;
  const historical = chart.quotes ?? [];

  const normalized = historical
    .filter(
      (point) =>
        point.date &&
        point.open !== null &&
        point.open !== undefined &&
        point.high !== null &&
        point.high !== undefined &&
        point.low !== null &&
        point.low !== undefined &&
        point.close !== null &&
        point.close !== undefined,
    )
    .map((point) => ({
      close: Number(point.close),
      date: point.date!.toISOString(),
      high: Number(point.high),
      low: Number(point.low),
      open: Number(point.open),
      volume: point.volume ?? null,
    }));

  const closes = normalized.map((point) => point.close);

  return normalized.map((point, index) => ({
    ...point,
    ma20: getMovingAverage(closes, 20, index),
    ma60: getMovingAverage(closes, 60, index),
    ma120: getMovingAverage(closes, 120, index),
  }));
}

export async function getMarketIndices(): Promise<MarketIndexItem[]> {
  return Promise.all(
    MARKET_INDEX_DEFINITIONS.map(async ({ symbol, label }) => {
      try {
        const quote = (await yahooFinance.quote(symbol)) as YahooQuoteResult;

        return {
          symbol,
          label,
          value: quote.regularMarketPrice ?? null,
          changePercent: quote.regularMarketChangePercent ?? null,
        };
      } catch {
        return {
          symbol,
          label,
          value: null,
          changePercent: null,
        };
      }
    }),
  );
}
