"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Loader2, RefreshCw, Trash2 } from "lucide-react";
import type { AnalysisReport, StockChartPoint, StockDrawerDetail, StockMemo } from "@/types/stock";
import { saveMemoAction } from "@/app/(routes)/stocks/actions";

type ChartRange = "1M" | "3M" | "6M";

type StockDrawerProps = {
  detail: StockDrawerDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (stockId: string, stockName: string) => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
  isQuoteRefreshing?: boolean;
};

const chartRanges: ChartRange[] = ["1M", "3M", "6M"];

function waitMinimumSpinnerTime() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 300);
  });
}

function formatPrice(value: number | null, currency: string | undefined) {
  if (value === null) {
    return "--";
  }

  return new Intl.NumberFormat("ko-KR", {
    currency: currency ?? "USD",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatSignedPercent(value: number | null) {
  if (value === null) {
    return "--";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function parsePositiveIntInput(value: string): number | null {
  const raw = value.replace(/,/g, "").trim();

  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function myAvgCostReturnPercent(
  current: number | null | undefined,
  avgPrice: number | null,
): number | null {
  if (current == null || avgPrice == null || avgPrice <= 0) {
    return null;
  }

  return ((current - avgPrice) / avgPrice) * 100;
}

function formatDateLabel(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Seoul",
  })
    .format(date)
    .replace(/\s/g, "")
    .replace("월", ".")
    .replace("일", "");
}

function formatPublishedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function formatDisclosureDate(value: string) {
  if (!/^\d{8}$/.test(value)) {
    return value;
  }

  return `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function getRangeStartDate(range: ChartRange, latestPointDate: string | undefined) {
  const date = latestPointDate ? new Date(latestPointDate) : new Date();
  const months = range === "1M" ? 1 : range === "3M" ? 3 : 6;
  date.setMonth(date.getMonth() - months);
  return date;
}

function filterChartPoints(points: StockChartPoint[], range: ChartRange) {
  const startDate = getRangeStartDate(range, points.at(-1)?.date);
  return points.filter((point) => new Date(point.date) >= startDate);
}

function StockChart({
  isPending,
  points,
}: {
  isPending: boolean;
  points: StockChartPoint[];
}) {
  const width = 760;
  const height = 280;
  const padding = 24;

  if (isPending) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-[16px] border border-[#23252a] bg-[#0f1011]">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#34343a] border-t-[#5e6ad2]" />
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-[16px] border border-[#23252a] bg-[#0f1011] text-[13px] text-[#8a8f98]">
        차트 데이터가 없습니다.
      </div>
    );
  }

  const values = points.flatMap((point) => [
    point.high,
    point.low,
    point.ma20 ?? point.close,
    point.ma60 ?? point.close,
    point.ma120 ?? point.close,
  ]);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const stepX = points.length > 1 ? chartWidth / (points.length - 1) : chartWidth;

  function getY(value: number) {
    if (maxValue === minValue) {
      return height / 2;
    }

    return padding + ((maxValue - value) / (maxValue - minValue)) * chartHeight;
  }

  function getPolyline(key: "ma20" | "ma60" | "ma120") {
    return points
      .map((point, index) => {
        const value = point[key];

        if (value === null) {
          return null;
        }

        return `${padding + index * stepX},${getY(value)}`;
      })
      .filter(Boolean)
      .join(" ");
  }

  return (
    <div className="rounded-[16px] border border-[#23252a] bg-[#0f1011] p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] w-full">
        {[0, 1, 2, 3].map((line) => {
          const y = padding + (chartHeight / 3) * line;

          return (
            <line
              key={line}
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              stroke="#23252a"
              strokeWidth="1"
            />
          );
        })}

        {points.map((point, index) => {
          const x = padding + index * stepX;
          const openY = getY(point.open);
          const closeY = getY(point.close);
          const highY = getY(point.high);
          const lowY = getY(point.low);
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(Math.abs(closeY - openY), 2);
          const color = point.close >= point.open ? "#27a644" : "#e5484d";

          return (
            <g key={point.date}>
              <line x1={x} x2={x} y1={highY} y2={lowY} stroke={color} strokeWidth="1.2" />
              <rect
                x={x - 3}
                y={bodyTop}
                width="6"
                height={bodyHeight}
                fill={color}
                rx="1.5"
              />
            </g>
          );
        })}

        <polyline
          fill="none"
          points={getPolyline("ma20")}
          stroke="#5e6ad2"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          fill="none"
          points={getPolyline("ma60")}
          stroke="#27a644"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          fill="none"
          points={getPolyline("ma120")}
          stroke="#8a8f98"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points
          .filter((_, index) => index === 0 || index === points.length - 1 || index === Math.floor(points.length / 2))
          .map((point, index) => {
            const pointIndex = points.findIndex((item) => item.date === point.date);
            return (
              <text
                key={`${point.date}-${index}`}
                x={padding + pointIndex * stepX}
                y={height - 8}
                fill="#8a8f98"
                fontSize="11"
                textAnchor="middle"
              >
                {formatDateLabel(point.date)}
              </text>
            );
          })}
      </svg>
    </div>
  );
}

export function StockDrawer({
  detail,
  isOpen,
  onClose,
  onDelete,
  onRefresh,
}: StockDrawerProps) {
  const router = useRouter();
  const renderedDetail = detail;
  const [range, setRange] = useState<ChartRange>("3M");
  const [isChartPending, startTransition] = useTransition();
  const [analysis, setAnalysis] = useState<AnalysisReport | null>(detail?.analysis ?? null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [memo, setMemo] = useState<StockMemo | null>(detail?.memo ?? null);
  const [buyReason, setBuyReason] = useState(detail?.memo?.buyReason ?? "");
  const [stopLoss, setStopLoss] = useState(detail?.memo?.stopLoss ?? "");
  const [targetPrice, setTargetPrice] = useState(() => String(detail?.memo?.targetPrice ?? ""));
  const [content, setContent] = useState(detail?.memo?.content ?? "");
  const [sharesInput, setSharesInput] = useState(() =>
    detail?.memo?.shares != null && detail.memo.shares > 0 ? String(detail.memo.shares) : "",
  );
  const [avgPriceInput, setAvgPriceInput] = useState(() =>
    detail?.memo?.avgPrice != null && detail.memo.avgPrice > 0 ? String(detail.memo.avgPrice) : "",
  );

  const [isMemoPending, startMemoTransition] = useTransition();
  const [memoMessage, setMemoMessage] = useState<string | null>(null);
  const [memoError, setMemoError] = useState<string | null>(null);
  const [isDisclosuresOpen, setIsDisclosuresOpen] = useState(false);
  const [isQuoteRefreshing, setIsQuoteRefreshing] = useState(false);
  const [isNewsRefreshing, setIsNewsRefreshing] = useState(false);

  useEffect(() => {
    setRange("3M");
    setAnalysis(renderedDetail?.analysis ?? null);
    setAnalysisError(null);

    setMemo(renderedDetail?.memo ?? null);
    setBuyReason(renderedDetail?.memo?.buyReason ?? "");
    setStopLoss(renderedDetail?.memo?.stopLoss ?? "");
    setTargetPrice(String(renderedDetail?.memo?.targetPrice ?? ""));
    setContent(renderedDetail?.memo?.content ?? "");
    setSharesInput(
      renderedDetail?.memo?.shares != null && renderedDetail.memo.shares > 0
        ? String(renderedDetail.memo.shares)
        : "",
    );
    setAvgPriceInput(
      renderedDetail?.memo?.avgPrice != null && renderedDetail.memo.avgPrice > 0
        ? String(renderedDetail.memo.avgPrice)
        : "",
    );
    setMemoMessage(null);
    setMemoError(null);
    setIsDisclosuresOpen(false);
  }, [renderedDetail?.stock.ticker, renderedDetail?.memo, renderedDetail?.analysis]);

  const normalizedBuyReason = buyReason.trim();
  const normalizedStopLoss = stopLoss.trim();
  const normalizedTargetPrice = String(targetPrice).trim();
  const normalizedContent = content.trim();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!renderedDetail) {
    return null;
  }

  const filteredPoints = filterChartPoints(renderedDetail.chart, range);
  const quote = renderedDetail.stockQuote;
  const changePercent = quote?.marketChangePercent ?? null;
  const isPositive = (changePercent ?? 0) > 0;
  const isNegative = (changePercent ?? 0) < 0;
  const parsedAvgForReturn = parsePositiveIntInput(avgPriceInput) ?? memo?.avgPrice ?? null;
  const myReturnPercent = myAvgCostReturnPercent(quote?.marketPrice, parsedAvgForReturn);

  async function handleAnalyze() {
    if (!renderedDetail) {
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stock_id: renderedDetail.stock.id,
          ticker: renderedDetail.stock.ticker,
          name: renderedDetail.stock.name,
        }),
      });
      const json = (await response.json()) as {
        error?: string;
        result?: AnalysisReport;
      };

      if (!response.ok || !json.result) {
        setAnalysisError(json.error ?? "AI 분석 요청에 실패했습니다.");
        return;
      }

      setAnalysis(json.result);
    } catch {
      setAnalysisError("AI 분석 요청에 실패했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleSaveMemo() {
    if (!renderedDetail) {
      return;
    }

    setMemoMessage(null);
    setMemoError(null);

    startMemoTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("stockId", renderedDetail.stock.id);
        formData.set("buyReason", buyReason);
        formData.set("stopLoss", stopLoss);
        formData.set("targetPrice", String(targetPrice));
        formData.set("content", content);
        formData.set("shares", sharesInput);
        formData.set("avgPrice", avgPriceInput);

        const result = await saveMemoAction(formData);

        if (!result.ok) {
          setMemoError(result.message ?? "메모 저장에 실패했습니다.");
          return;
        }

        const nowIso = new Date().toISOString();
        const savedShares = parsePositiveIntInput(sharesInput);
        const savedAvgPrice = parsePositiveIntInput(avgPriceInput);
        setMemo((prev) => ({
          buyReason: normalizedBuyReason,
          stopLoss: normalizedStopLoss,
          targetPrice: normalizedTargetPrice,
          content: normalizedContent,
          shares: savedShares,
          avgPrice: savedAvgPrice,
          createdAt: prev?.createdAt ?? nowIso,
          updatedAt: nowIso,
        }));

        setMemoMessage(result.message ?? "저장 완료");
        router.refresh();
      } catch {
        setMemoError("메모 저장에 실패했습니다.");
      }
    });
  }

  const handleRefresh = async () => {
    setIsQuoteRefreshing(true);
    try {
      await Promise.all([
        Promise.resolve(onRefresh()),
        waitMinimumSpinnerTime(),
      ]);
    } catch {
      // 새로고침 실패 시에도 스피너는 반드시 종료한다.
    } finally {
      setIsQuoteRefreshing(false);
    }
  };

  const handleNewsRefresh = async () => {
    setIsNewsRefreshing(true);
    try {
      await Promise.all([
        Promise.resolve(router.refresh()),
        waitMinimumSpinnerTime(),
      ]);
    } finally {
      setIsNewsRefreshing(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      <button
        type="button"
        aria-label="드로어 닫기"
        onClick={onClose}
        className={`absolute inset-0 bg-black/55 transition-opacity duration-[180ms] ease-out ${isOpen ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-[760px] overflow-y-auto border-l border-[#23252a] bg-[#010102] p-6 text-[#f7f8f8] shadow-[-24px_0_80px_rgba(0,0,0,0.45)] transition-transform duration-[180ms] ease-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="min-w-0 break-words text-[28px] font-semibold tracking-[-0.03em]">
                {renderedDetail.stock.name}
              </h2>
              <span className="rounded-full border border-[#23252a] bg-[#141516] px-2.5 py-1 font-mono text-[12px] uppercase tracking-[0.16em] text-[#8a8f98]">
                {renderedDetail.stock.ticker}
              </span>
            </div>
            <p className="text-[13px] text-[#8a8f98]">
              {renderedDetail.stock.status === "holding" ? "보유 종목" : "관심 종목"}
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              aria-label="종목 삭제"
              onClick={() => onDelete(renderedDetail.stock.id, renderedDetail.stock.name)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#3e3e44] bg-[#141516] text-[#e5484d] transition hover:border-[#e5484d]"
            >
              <Trash2 size={18} />
            </button>
            <button
              type="button"
              aria-label="드로어 새로고침"
              onClick={handleRefresh}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#23252a] bg-[#141516] text-[#f7f8f8] transition hover:border-[#5e6ad2]"
            >
              {isQuoteRefreshing ? (
                <Loader2 size={18} className="animate-spin text-[#5e6ad2]" />
              ) : (
                <RefreshCw size={18} />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[8px] border border-[#23252a] bg-[#141516] px-3 py-2 text-[14px] text-[#f7f8f8] transition hover:border-[#5e6ad2]"
            >
              닫기
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-[16px] border border-[#23252a] bg-[#0f1011] p-5">
          <div
            className={`grid gap-4 md:gap-x-8 ${
              myReturnPercent !== null ? "md:grid-cols-5" : "md:grid-cols-4"
            }`}
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <p className="text-[12px] uppercase tracking-[0.16em] text-[#8a8f98]">현재가</p>
                {isQuoteRefreshing ? (
                  <Loader2 size={14} className="animate-spin text-[#5e6ad2]" />
                ) : null}
              </div>
              <p className="mt-2 flex min-h-[44px] items-end text-[30px] font-semibold leading-none tracking-[-0.04em]">
                {formatPrice(quote?.marketPrice ?? null, quote?.currency)}
              </p>
              {renderedDetail.stockQuoteError ? (
                <p className="mt-2 text-[13px] text-[#e5484d]">{renderedDetail.stockQuoteError}</p>
              ) : null}
            </div>
            <div className="flex flex-col">
              <p className="text-[12px] uppercase tracking-[0.16em] text-[#8a8f98]">등락률</p>
              <p
                className="mt-2 flex min-h-[44px] items-end text-[22px] font-medium leading-none tracking-[-0.03em]"
                style={{
                  color: isPositive ? "#27a644" : isNegative ? "#e5484d" : "#f7f8f8",
                }}
              >
                {formatSignedPercent(changePercent)}
              </p>
            </div>
            {myReturnPercent !== null ? (
              <div className="flex flex-col">
                <p className="text-[12px] uppercase tracking-[0.16em] text-[#8a8f98]">내 수익률</p>
                <p
                  className="mt-2 flex min-h-[44px] items-end text-[22px] font-medium leading-none tracking-[-0.03em]"
                  style={{
                    color:
                      myReturnPercent > 0 ? "#27a644" : myReturnPercent < 0 ? "#e5484d" : "#f7f8f8",
                  }}
                >
                  {formatSignedPercent(myReturnPercent)}
                </p>
              </div>
            ) : null}
            <div className="flex flex-col">
              <p className="text-[12px] uppercase tracking-[0.16em] text-[#8a8f98]">52주 고가</p>
              <p className="mt-2 flex min-h-[44px] items-end text-[22px] font-medium leading-none tracking-[-0.03em]">
                {formatPrice(quote?.fiftyTwoWeekHigh ?? null, quote?.currency)}
              </p>
            </div>
            <div className="flex flex-col">
              <p className="text-[12px] uppercase tracking-[0.16em] text-[#8a8f98]">52주 저가</p>
              <p className="mt-2 flex min-h-[44px] items-end text-[22px] font-medium leading-none tracking-[-0.03em]">
                {formatPrice(quote?.fiftyTwoWeekLow ?? null, quote?.currency)}
              </p>
            </div>
          </div>
        </div>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[20px] font-medium tracking-[-0.03em]">일봉 차트</h3>
              <p className="mt-1 text-[13px] text-[#8a8f98]">
                캔들 차트와 20일, 60일, 120일 이동평균선을 보여줍니다.
              </p>
            </div>
            <div className="flex gap-2 rounded-full border border-[#23252a] bg-[#0f1011] p-1">
              {chartRanges.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => startTransition(() => setRange(item))}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                    range === item ? "bg-[#141516] text-[#f7f8f8]" : "text-[#8a8f98]"
                  }`}
                >
                  {item === "1M" ? "1개월" : item === "3M" ? "3개월" : "6개월"}
                </button>
              ))}
            </div>
          </div>
          {renderedDetail.chartError ? (
            <div className="rounded-[16px] border border-[#23252a] bg-[#0f1011] px-5 py-8 text-[13px] text-[#e5484d]">
              {renderedDetail.chartError}
            </div>
          ) : (
            <StockChart isPending={isChartPending} points={filteredPoints} />
          )}
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[20px] font-medium tracking-[-0.03em]">AI 분석 리포트</h3>
              <p className="mt-1 text-[13px] text-[#8a8f98]">
                시세, 뉴스, 공시를 종합해 매수/매도/관망 의견을 제공합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="rounded-[8px] bg-[#5e6ad2] px-3 py-2 text-[14px] font-medium text-white transition hover:bg-[#828fff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAnalyzing ? "분석 중..." : analysis ? "재분석" : "분석 시작"}
            </button>
          </div>
          <div className="rounded-[16px] border border-[#23252a] bg-[#0f1011] p-5">
            {analysisError ? <p className="text-[13px] text-[#e5484d]">{analysisError}</p> : null}
            {!analysis && !analysisError ? <p className="text-[13px] text-[#8a8f98]">아직 분석 없음</p> : null}
            {analysis ? (
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] uppercase tracking-[0.16em] text-[#8a8f98]">의견</span>
                  <span
                    className="rounded-full px-2.5 py-1 text-[12px] font-medium"
                    style={{
                      backgroundColor:
                        analysis.opinion === "매수"
                          ? "rgba(39,166,68,0.12)"
                          : analysis.opinion === "매도"
                            ? "rgba(229,72,77,0.12)"
                            : "rgba(138,143,152,0.2)",
                      color:
                        analysis.opinion === "매수"
                          ? "#27a644"
                          : analysis.opinion === "매도"
                            ? "#e5484d"
                            : "#d0d6e0",
                    }}
                  >
                    {analysis.opinion}
                  </span>
                  <span className="text-[12px] text-[#8a8f98]">{formatDateTime(analysis.createdAt)}</span>
                </div>
                <div>
                  <p className="text-[12px] uppercase tracking-[0.16em] text-[#8a8f98]">현재 상황 요약</p>
                  <p className="mt-2 text-[14px] leading-6 text-[#f7f8f8]">{analysis.summary}</p>
                </div>
                <div>
                  <p className="text-[12px] uppercase tracking-[0.16em] text-[#8a8f98]">긍정 요인</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] leading-6 text-[#d0d6e0]">
                    {(Array.isArray(analysis.positives) ? analysis.positives : []).map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[12px] uppercase tracking-[0.16em] text-[#8a8f98]">리스크 요인</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] leading-6 text-[#d0d6e0]">
                    {(Array.isArray(analysis.risks) ? analysis.risks : []).map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[20px] font-medium tracking-[-0.03em]">최신 뉴스</h3>
              <p className="mt-1 text-[13px] text-[#8a8f98]">
                Google News RSS 기준 최신 5건입니다.
              </p>
            </div>
            <button
              type="button"
              aria-label="뉴스 새로고침"
              onClick={() => {
                void handleNewsRefresh();
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#23252a] bg-[#141516] text-[#f7f8f8] transition hover:border-[#5e6ad2]"
            >
              {isNewsRefreshing ? (
                <Loader2 size={18} className="animate-spin text-[#5e6ad2]" />
              ) : (
                <RefreshCw size={18} />
              )}
            </button>
          </div>
          <div className="rounded-[16px] border border-[#23252a] bg-[#0f1011]">
            {renderedDetail.newsError ? (
              <div className="px-5 py-6 text-[13px] text-[#e5484d]">{renderedDetail.newsError}</div>
            ) : renderedDetail.news.length === 0 ? (
              <div className="px-5 py-6 text-[13px] text-[#8a8f98]">뉴스가 없습니다.</div>
            ) : (
              renderedDetail.news.map((item) => (
                <a
                  key={`${item.link}-${item.publishedAt}`}
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col gap-2 border-b border-[#23252a] px-5 py-4 last:border-b-0 transition hover:bg-[#141516]"
                >
                  <span className="text-[15px] leading-6 text-[#f7f8f8]">{item.title}</span>
                  <span className="text-[12px] text-[#8a8f98]">
                    {item.source} · {formatPublishedAt(item.publishedAt)}
                  </span>
                </a>
              ))
            )}
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[20px] font-medium tracking-[-0.03em]">최신 공시</h3>
              <p className="mt-1 text-[13px] text-[#8a8f98]">
                OpenDART 기준 최근 30일 내 최신 5건입니다.
              </p>
            </div>
            <button
              type="button"
              aria-label="공시 펼치기/접기"
              onClick={() => setIsDisclosuresOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#23252a] bg-[#141516] text-[#f7f8f8] transition hover:border-[#5e6ad2]"
            >
              {isDisclosuresOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
          {isDisclosuresOpen ? (
            <div className="mt-3 overflow-hidden rounded-[16px] border border-[#23252a] bg-[#0f1011]">
              {renderedDetail.disclosuresError ? (
                <div className="px-5 py-6 text-[13px] text-[#e5484d]">{renderedDetail.disclosuresError}</div>
              ) : renderedDetail.disclosures.length === 0 ? (
                <div className="px-5 py-6 text-[13px] text-[#8a8f98]">공시가 없습니다.</div>
              ) : (
                renderedDetail.disclosures.map((item) => (
                  <a
                    key={item.receiptNo}
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col gap-2 border-b border-[#23252a] px-5 py-4 last:border-b-0 transition hover:bg-[#141516]"
                  >
                    <span className="text-[15px] leading-6 text-[#f7f8f8]">{item.title}</span>
                    <span className="text-[12px] text-[#8a8f98]">
                      {item.type} · {formatDisclosureDate(item.filedAt)}
                    </span>
                  </a>
                ))
              )}
            </div>
          ) : null}
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <h3 className="text-[20px] font-medium tracking-[-0.03em]">투자 메모</h3>
            <p className="mt-1 text-[13px] text-[#8a8f98]">
              보유 수량·평균 단가, 매수 이유, 손절 기준, 목표가, 자유 메모를 기록합니다.
            </p>
          </div>
          <div className="rounded-[16px] border border-[#23252a] bg-[#0f1011] p-5">
            <div className="mb-4">
              {memo?.updatedAt ? (
                <p className="text-[12px] text-[#8a8f98]">
                  마지막 수정: {formatDateTime(memo.updatedAt)}
                </p>
              ) : (
                <p className="text-[12px] text-[#8a8f98]">아직 작성된 메모가 없습니다.</p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-[13px] text-[#d0d6e0]">보유 주식 수</span>
                <input
                  inputMode="numeric"
                  value={sharesInput}
                  onChange={(event) => setSharesInput(event.target.value.replace(/\D/g, ""))}
                  placeholder="예: 100"
                  className="rounded-[8px] border border-[#23252a] bg-[#141516] px-3 py-2.5 text-[14px] text-[#f7f8f8] outline-none transition focus:border-[#5e6ad2] focus:ring-1 focus:ring-[#5e6ad2]"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[13px] text-[#d0d6e0]">평균 매입 단가 (원)</span>
                <input
                  inputMode="decimal"
                  value={avgPriceInput}
                  onChange={(event) => setAvgPriceInput(event.target.value.replace(/[^\d,]/g, ""))}
                  placeholder="예: 70000"
                  className="rounded-[8px] border border-[#23252a] bg-[#141516] px-3 py-2.5 text-[14px] text-[#f7f8f8] outline-none transition focus:border-[#5e6ad2] focus:ring-1 focus:ring-[#5e6ad2]"
                />
              </label>
              <label className="flex flex-col gap-2 md:col-span-2">
                <span className="text-[13px] text-[#d0d6e0]">매수 이유</span>
                <textarea
                  value={buyReason}
                  onChange={(event) => setBuyReason(event.target.value)}
                  placeholder="예: 실적 개선/밸류에이션 매력/성장 기대 등"
                  className="min-h-[90px] resize-none rounded-[8px] border border-[#23252a] bg-[#141516] px-3 py-2.5 text-[14px] text-[#f7f8f8] outline-none transition focus:border-[#5e6ad2] focus:ring-1 focus:ring-[#5e6ad2]"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-[13px] text-[#d0d6e0]">손절 기준</span>
                <input
                  value={stopLoss}
                  onChange={(event) => setStopLoss(event.target.value)}
                  placeholder="예: -5% 또는 10,000원 등"
                  className="rounded-[8px] border border-[#23252a] bg-[#141516] px-3 py-2.5 text-[14px] text-[#f7f8f8] outline-none transition focus:border-[#5e6ad2] focus:ring-1 focus:ring-[#5e6ad2]"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-[13px] text-[#d0d6e0]">목표가</span>
                <input
                  value={targetPrice}
                  onChange={(event) => setTargetPrice(event.target.value)}
                  placeholder="예: 15,000원 또는 가격대/기간"
                  className="rounded-[8px] border border-[#23252a] bg-[#141516] px-3 py-2.5 text-[14px] text-[#f7f8f8] outline-none transition focus:border-[#5e6ad2] focus:ring-1 focus:ring-[#5e6ad2]"
                />
              </label>

              <label className="flex flex-col gap-2 md:col-span-2">
                <span className="text-[13px] text-[#d0d6e0]">자유 메모</span>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="추가 생각/체크포인트 등을 자유롭게 남겨두세요."
                  className="min-h-[90px] resize-none rounded-[8px] border border-[#23252a] bg-[#141516] px-3 py-2.5 text-[14px] text-[#f7f8f8] outline-none transition focus:border-[#5e6ad2] focus:ring-1 focus:ring-[#5e6ad2]"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="min-h-[18px] flex-1">
                {memoError ? <p className="text-[13px] text-[#e5484d]">{memoError}</p> : null}
                {!memoError && memoMessage ? (
                  <p className="text-[13px] text-[#d0d6e0]">{memoMessage}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleSaveMemo}
                disabled={isMemoPending}
                className="rounded-[8px] bg-[#5e6ad2] px-3 py-2 text-[14px] font-medium text-white transition hover:bg-[#828fff] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isMemoPending ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}
