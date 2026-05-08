export type StockStatus = "holding" | "watching";

export type StockLookup = {
  ticker: string;
  name: string;
  market: string;
};

export type StockItem = {
  id: string;
  ticker: string;
  name: string;
  market: string;
  status: StockStatus;
  createdAt: string;
  updatedAt: string;
};

export type StockQuote = {
  symbol: string;
  shortName: string;
  currency: string;
  marketPrice: number | null;
  marketChange: number | null;
  marketChangePercent: number | null;
};

export type NewsItem = {
  title: string;
  link: string;
  publishedAt: string;
  source: string;
};
