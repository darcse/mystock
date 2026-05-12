import type { PortfolioSummaryData } from "@/types/stock";

type PortfolioSummaryProps = {
  data: PortfolioSummaryData | null;
};

function formatWon(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function PortfolioSummary({ data }: PortfolioSummaryProps) {
  if (!data || data.positionCount === 0) {
    return (
      <section className="rounded-[16px] border border-[#23252a] bg-[#0f1011] px-5 py-6 text-[14px] text-[#8a8f98]">
        포트폴리오 데이터 없음
      </section>
    );
  }

  const profitPositive = data.totalProfit > 0;
  const profitNegative = data.totalProfit < 0;
  const pctPositive = data.profitPercent > 0;
  const pctNegative = data.profitPercent < 0;

  return (
    <section className="rounded-[16px] border border-[#23252a] bg-[#0f1011] p-4 text-[#f7f8f8]">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-medium uppercase tracking-[0.2em] text-[#8a8f98]">
          포트폴리오 요약
        </h2>
        <span className="text-[12px] text-[#8a8f98]">보유·평단·수량 입력 종목 기준</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-[14px] border border-[#23252a] bg-[#141516] px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a8f98]">총 투자금</p>
          <p className="mt-2 text-[18px] font-medium tabular-nums tracking-[-0.02em]">
            {formatWon(data.totalCostBasis)}원
          </p>
        </div>
        <div className="rounded-[14px] border border-[#23252a] bg-[#141516] px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a8f98]">평가금액</p>
          <p className="mt-2 text-[18px] font-medium tabular-nums tracking-[-0.02em]">
            {formatWon(data.totalMarketValue)}원
          </p>
        </div>
        <div className="rounded-[14px] border border-[#23252a] bg-[#141516] px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a8f98]">수익금</p>
          <p
            className="mt-2 text-[18px] font-medium tabular-nums tracking-[-0.02em]"
            style={{
              color: profitPositive ? "#27a644" : profitNegative ? "#e5484d" : "#d0d6e0",
            }}
          >
            {data.totalProfit > 0 ? "+" : ""}
            {formatWon(data.totalProfit)}원
          </p>
        </div>
        <div className="rounded-[14px] border border-[#23252a] bg-[#141516] px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a8f98]">수익률</p>
          <p
            className="mt-2 text-[18px] font-medium tabular-nums tracking-[-0.02em]"
            style={{
              color: pctPositive ? "#27a644" : pctNegative ? "#e5484d" : "#d0d6e0",
            }}
          >
            {formatSignedPercent(data.profitPercent)}
          </p>
        </div>
        <div className="rounded-[14px] border border-[#23252a] bg-[#141516] px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a8f98]">보유 종목 수</p>
          <p className="mt-2 text-[18px] font-medium tabular-nums tracking-[-0.02em]">
            {data.positionCount}개
          </p>
        </div>
      </div>
    </section>
  );
}
