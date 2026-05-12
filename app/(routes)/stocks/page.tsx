import { getDartDisclosures } from "@/lib/dart";
import { getStockNews } from "@/lib/news";
import { StocksManager } from "@/components/features/StocksManager";
import { Footer } from "@/components/ui/Footer";
import { MarketIndicesBar } from "@/components/ui/MarketIndicesBar";
import { getMarketIndices, getStockChart, getStockDashboardQuote, getStockQuote } from "@/lib/yahoo";
import { createClient } from "@/lib/supabase/server";
import type {
  AnalysisOpinion,
  MarketIndexItem,
  PortfolioSummaryData,
  StockDashboardItem,
  StockDrawerDetail,
  StockItem,
} from "@/types/stock";

function buildPortfolioSummary(stocks: StockDashboardItem[]): PortfolioSummaryData | null {
  let totalCostBasis = 0;
  let totalMarketValue = 0;
  let positionCount = 0;

  for (const stock of stocks) {
    if (stock.status !== "holding") {
      continue;
    }

    const shares = stock.memoShares;
    const avg = stock.memoAvgPrice;
    const price = stock.quote?.marketPrice ?? null;

    if (
      shares == null ||
      avg == null ||
      price == null ||
      !Number.isFinite(shares) ||
      !Number.isFinite(avg) ||
      !Number.isFinite(price) ||
      shares <= 0 ||
      avg <= 0 ||
      price < 0
    ) {
      continue;
    }

    totalCostBasis += avg * shares;
    totalMarketValue += price * shares;
    positionCount += 1;
  }

  if (positionCount === 0 || totalCostBasis <= 0) {
    return null;
  }

  const totalProfit = totalMarketValue - totalCostBasis;
  const profitPercent = (totalProfit / totalCostBasis) * 100;

  return {
    totalCostBasis,
    totalMarketValue,
    totalProfit,
    profitPercent,
    positionCount,
  };
}

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

async function resolveDetail(stock: StockDashboardItem, userId: string): Promise<StockDrawerDetail> {
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
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: memo } = await supabase
    .from("memos")
    .select("content, buy_reason, stop_loss, target_price, shares, avg_price, created_at, updated_at")
    .eq("stock_id", stock.id)
    .eq("user_id", userId)
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
    memo: memo
      ? {
          buyReason: memo.buy_reason ?? "",
          stopLoss: memo.stop_loss ?? "",
          targetPrice: memo.target_price ?? "",
          content: memo.content ?? "",
          shares: memo.shares ?? null,
          avgPrice: memo.avg_price ?? null,
          createdAt: memo.created_at,
          updatedAt: memo.updated_at,
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
  const marketIndices = await getMarketIndices().catch((): MarketIndexItem[] => []);
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

    const memoByStockId = new Map<
      string,
      {
        shares: number | null;
        avg_price: number | null;
        stop_loss: string | null;
        target_price: number | null;
      }
    >();

    function normalizeMemoTargetPrice(value: unknown): number | null {
      if (value == null) {
        return null;
      }
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        return Math.trunc(value);
      }
      const digits = String(value).replace(/\D/g, "");
      if (!digits) {
        return null;
      }
      const n = Number.parseInt(digits, 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    }

    if (stockIds.length > 0) {
      const { data: memoRows } = await supabase
        .from("memos")
        .select("stock_id, shares, avg_price, stop_loss, target_price")
        .in("stock_id", stockIds)
        .eq("user_id", user.id);

      for (const row of memoRows ?? []) {
        memoByStockId.set(row.stock_id, {
          shares: row.shares ?? null,
          avg_price: row.avg_price ?? null,
          stop_loss: row.stop_loss ?? null,
          target_price: normalizeMemoTargetPrice(row.target_price),
        });
      }
    }

    stocks = await Promise.all(
      stockItems.map(async (stock) => {
        const { quote, quoteError } = await getStockDashboardQuote(stock.ticker);
        const memoRow = memoByStockId.get(stock.id);

        return {
          ...stock,
          latestAnalysisSummary: latestSummaryByStockId.get(stock.id) ?? null,
          quote,
          quoteError,
          memoAvgPrice: memoRow?.avg_price ?? null,
          memoShares: memoRow?.shares ?? null,
          memoStopLoss: memoRow?.stop_loss ?? null,
          memoTargetPrice: memoRow?.target_price ?? null,
        };
      }),
    );

    if (selectedTicker) {
      const selectedStock = stocks.find((stock) => stock.ticker === selectedTicker) ?? null;

      if (selectedStock) {
        selectedDetail = await resolveDetail(selectedStock, user.id);
      }
    }
  }

  const portfolioSummary = user ? buildPortfolioSummary(stocks) : null;

  return (
    <main className="flex min-h-screen flex-col bg-[#010102] px-4 py-10 md:px-8">
      <div className="flex min-h-0 flex-1 flex-col pb-14 md:pb-20">
        <StocksManager
          initialStocks={stocks}
          isAuthenticated={Boolean(user)}
          marketIndicesBar={<MarketIndicesBar indices={marketIndices} />}
          portfolioSummary={portfolioSummary}
          selectedDetail={selectedDetail}
        />
      </div>
      <Footer isAuthenticated={Boolean(user)} />
    </main>
  );
}
