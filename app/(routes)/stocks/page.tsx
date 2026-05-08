import { StocksManager } from "@/components/features/StocksManager";
import { createClient } from "@/lib/supabase/server";

type StockItem = {
  id: string;
  ticker: string;
  name: string;
  market: string;
  status: "holding" | "watching";
  createdAt: string;
  updatedAt: string;
};

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

  let stocks: StockItem[] = [];

  if (user) {
    const { data } = await supabase
      .from("stocks")
      .select("id, ticker, name, market, status, created_at, updated_at")
      .order("created_at", { ascending: false });

    stocks = (data ?? []).map(mapStockItem);
  }

  return (
    <main className="min-h-screen bg-[#010102] px-4 py-10 md:px-8">
      <StocksManager initialStocks={stocks} isAuthenticated={Boolean(user)} />
    </main>
  );
}
