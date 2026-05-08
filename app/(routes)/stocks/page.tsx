import { getDartDisclosures } from "@/lib/dart";
import { getStockNews } from "@/lib/news";
import { StocksManager } from "@/components/features/StocksManager";
import { getStockChart, getStockDashboardQuote, getStockQuote } from "@/lib/yahoo";
import { createClient } from "@/lib/supabase/server";
import type {
  AnalysisOpinion,
  StockDashboardItem,
  StockDrawerDetail,
  StockItem,
} from "@/types/stock";

function mapStockItem(stock: {
  created_at: string;
  id: string;
  market: string;
  name: string;
  status: "holding" | "watching";
  ticker: string;
  updated_at: string;
}): StockItem {
  return {
    id: stock.id,
    ticker: stock.ticker,
    name: stock.name,
    market: stock.market,
    status: stock.status,
    createdAt: stock.created_at,
    updatedAt: stock.updated_at,
  };
}

type StocksPageProps = {
  searchParams: Promise<{
    ticker?: string;
  }>;
};

async function resolveDetail(stock: StockDashboardItem): Promise<StockDrawerDetail> {
  const [quoteResult, chartResult, newsResult, disclosureResult] = await Promise.allSettled([
    getStockQuote(stock.ticker),
    getStockChart(stock.ticker),
    getStockNews({ name: stock.name, ticker: stock.ticker }),
    getDartDisclosures(stock.ticker),
  ]);

  const supabase = await createClient();
  const { data: analysis } = await supabase
    .from("analyses")
    .select("summary, positives, risks, opinion, created_at")
    .eq("stock_id", stock.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    analysis: analysis
      ? {
          summary: analysis.summary ?? "",
          positives: analysis.positives ?? [],
          risks: analysis.risks ?? [],
          opinion: (analysis.opinion as AnalysisOpinion | null) ?? "관망",
          createdAt: analysis.created_at,
        }
      : null,
    chart: chartResult.status === "fulfilled" ? chartResult.value : [],
    chartError: chartResult.status === "rejected" ? String(chartResult.reason.message ?? chartResult.reason) : null,
    disclosures: disclosureResult.status === "fulfilled" ? disclosureResult.value : [],
    disclosuresError:
      disclosureResult.status === "rejected"
        ? String(disclosureResult.reason.message ?? disclosureResult.reason)
        : null,
    news: newsResult.status === "fulfilled" ? newsResult.value : [],
    newsError: newsResult.status === "rejected" ? String(newsResult.reason.message ?? newsResult.reason) : null,
    stock,
    stockQuote: quoteResult.status === "fulfilled" ? quoteResult.value : null,
    stockQuoteError:
      quoteResult.status === "rejected"
        ? String(quoteResult.reason.message ?? quoteResult.reason)
        : quoteResult.status === "fulfilled" && !quoteResult.value
          ? "시세를 불러오지 못했습니다."
          : null,
  };
}

export default async function StocksPage({ searchParams }: StocksPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const resolvedSearchParams = await searchParams;
  const selectedTicker = resolvedSearchParams.ticker?.trim().toUpperCase() ?? null;

  let stocks: StockDashboardItem[] = [];
  let selectedDetail: StockDrawerDetail | null = null;

  if (user) {
    const { data } = await supabase
      .from("stocks")
      .select("id, ticker, name, market, status, created_at, updated_at")
      .order("created_at", { ascending: false });

    const stockItems = (data ?? []).map(mapStockItem);
    const stockIds = stockItems.map((stock) => stock.id);
    const latestSummaryByStockId = new Map<string, string | null>();

    if (stockIds.length > 0) {
      const { data: analyses } = await supabase
        .from("analyses")
        .select("stock_id, summary, created_at")
        .in("stock_id", stockIds)
        .order("created_at", { ascending: false });

      for (const analysis of analyses ?? []) {
        if (!latestSummaryByStockId.has(analysis.stock_id)) {
          latestSummaryByStockId.set(analysis.stock_id, analysis.summary);
        }
      }
    }

    stocks = await Promise.all(
      stockItems.map(async (stock) => {
        const { quote, quoteError } = await getStockDashboardQuote(stock.ticker);

        return {
          ...stock,
          latestAnalysisSummary: latestSummaryByStockId.get(stock.id) ?? null,
          quote,
          quoteError,
        };
      }),
    );

    if (selectedTicker) {
      const selectedStock = stocks.find((stock) => stock.ticker === selectedTicker) ?? null;

      if (selectedStock) {
        selectedDetail = await resolveDetail(selectedStock);
      }
    }
  }

  return (
    <main className="min-h-screen bg-[#010102] px-4 py-10 md:px-8">
      <StocksManager
        initialStocks={stocks}
        isAuthenticated={Boolean(user)}
        selectedDetail={selectedDetail}
      />
    </main>
  );
}
