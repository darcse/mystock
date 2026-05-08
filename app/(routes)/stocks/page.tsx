import { StocksManager } from "@/components/features/StocksManager";
import { getStockDashboardQuote } from "@/lib/yahoo";
import { createClient } from "@/lib/supabase/server";
import type { StockDashboardItem, StockItem } from "@/types/stock";

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

export default async function StocksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let stocks: StockDashboardItem[] = [];

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
  }

  return (
    <main className="min-h-screen bg-[#010102] px-4 py-10 md:px-8">
      <StocksManager initialStocks={stocks} isAuthenticated={Boolean(user)} />
    </main>
  );
}
