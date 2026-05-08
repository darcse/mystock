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
