import type { MarketIndexItem } from "@/types/stock";

type MarketIndicesBarProps = {
  indices?: MarketIndexItem[];
  isLoading?: boolean;
};

const FALLBACK_INDICES: MarketIndexItem[] = [
  { symbol: "^KS11", label: "KOSPI", value: null, changePercent: null },
  { symbol: "^KQ11", label: "KOSDAQ", value: null, changePercent: null },
  { symbol: "^GSPC", label: "S&P500", value: null, changePercent: null },
  { symbol: "^IXIC", label: "NASDAQ", value: null, changePercent: null },
  { symbol: "KRW=X", label: "USD/KRW", value: null, changePercent: null },
];

function formatIndexValue(item: MarketIndexItem) {
  if (item.value === null) {
    return "—";
  }

  const maximumFractionDigits = item.symbol === "KRW=X" ? 2 : 2;

  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits,
  }).format(item.value);
}

function formatChangePercent(value: number | null) {
  if (value === null) {
    return "—";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function MarketIndicesBar({
  indices,
  isLoading = false,
}: MarketIndicesBarProps) {
  const items = indices && indices.length > 0 ? indices : FALLBACK_INDICES;

  return (
    <section className="rounded-[16px] border border-[#23252a] bg-[#0f1011] p-3 text-[#f7f8f8]">
      <div className="grid gap-2 md:grid-cols-5">
        {items.map((item) => {
          const isPositive = (item.changePercent ?? 0) > 0;
          const isNegative = (item.changePercent ?? 0) < 0;

          return (
            <div
              key={item.symbol}
              className="rounded-[14px] border border-[#23252a] bg-[#141516] px-3 py-3"
            >
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a8f98]">
                {item.label}
              </p>
              {isLoading ? (
                <div className="mt-2 space-y-2">
                  <div className="h-5 w-20 animate-pulse rounded bg-[#23252a]" />
                  <div className="h-4 w-14 animate-pulse rounded bg-[#23252a]" />
                </div>
              ) : (
                <>
                  <p className="mt-2 text-[18px] font-medium tracking-[-0.02em]">
                    {formatIndexValue(item)}
                  </p>
                  <p
                    className="mt-1 text-[13px] font-medium"
                    style={{
                      color: isPositive ? "#27a644" : isNegative ? "#e5484d" : "#8a8f98",
                    }}
                  >
                    {formatChangePercent(item.changePercent)}
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
