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

export type StockDashboardItem = StockItem & {
  latestAnalysisSummary: string | null;
  quote: StockQuote | null;
  quoteError: string | null;
};

export type StockQuote = {
  symbol: string;
  shortName: string;
  currency: string;
  marketPrice: number | null;
  marketChange: number | null;
  marketChangePercent: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
};

export type NewsItem = {
  title: string;
  link: string;
  publishedAt: string;
  source: string;
};

export type StockChartPoint = {
  close: number;
  date: string;
  high: number;
  low: number;
  ma120: number | null;
  ma20: number | null;
  ma60: number | null;
  open: number;
  volume: number | null;
};

export type DartDisclosure = {
  filedAt: string;
  link: string;
  receiptNo: string;
  title: string;
  type: string;
};

export type StockDrawerDetail = {
  chart: StockChartPoint[];
  chartError: string | null;
  disclosures: DartDisclosure[];
  disclosuresError: string | null;
  news: NewsItem[];
  newsError: string | null;
  stock: StockDashboardItem;
  stockQuote: StockQuote | null;
  stockQuoteError: string | null;
};
