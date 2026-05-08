"use client";

import { useEffect, useState, useTransition } from "react";
import type { AnalysisReport, StockChartPoint, StockDrawerDetail } from "@/types/stock";

type ChartRange = "1M" | "3M" | "6M";

type StockDrawerProps = {
  detail: StockDrawerDetail | null;
  isOpen: boolean;
  onClose: () => void;
};

const chartRanges: ChartRange[] = ["1M", "3M", "6M"];

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

function formatDateLabel(value: string) {
  const date = new Date(value);
  return `${date.getMonth() + 1}.${date.getDate()}`;
}

function formatPublishedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
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
  }).format(date);
}

function getRangeStartDate(range: ChartRange) {
  const date = new Date();
  const months = range === "1M" ? 1 : range === "3M" ? 3 : 6;
  date.setMonth(date.getMonth() - months);
  return date;
}

function filterChartPoints(points: StockChartPoint[], range: ChartRange) {
  const startDate = getRangeStartDate(range);
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
}: StockDrawerProps) {
  const [range, setRange] = useState<ChartRange>("3M");
  const [isChartPending, startTransition] = useTransition();
  const [analysis, setAnalysis] = useState<AnalysisReport | null>(detail?.analysis ?? null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

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

  useEffect(() => {
    setRange("3M");
    setAnalysis(detail?.analysis ?? null);
    setAnalysisError(null);
  }, [detail?.stock.ticker]);

  if (!detail) {
    return null;
  }

  const filteredPoints = filterChartPoints(detail.chart, range);
  const quote = detail.stockQuote;
  const changePercent = quote?.marketChangePercent ?? null;
  const isPositive = (changePercent ?? 0) > 0;
  const isNegative = (changePercent ?? 0) < 0;

  async function handleAnalyze() {
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stock_id: detail.stock.id,
          ticker: detail.stock.ticker,
          name: detail.stock.name,
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

  return (
    <div
      className={`fixed inset-0 z-50 transition ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        aria-label="드로어 닫기"
        onClick={onClose}
        className={`absolute inset-0 bg-black/55 transition ${isOpen ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-[760px] overflow-y-auto border-l border-[#23252a] bg-[#010102] p-6 text-[#f7f8f8] shadow-[-24px_0_80px_rgba(0,0,0,0.45)] transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[28px] font-semibold tracking-[-0.03em]">
                {detail.stock.name}
              </h2>
              <span className="rounded-full border border-[#23252a] bg-[#141516] px-2.5 py-1 font-mono text-[12px] uppercase tracking-[0.16em] text-[#8a8f98]">
                {detail.stock.ticker}
              </span>
              <span className="rounded-full border border-[#23252a] bg-[#141516] px-2.5 py-1 text-[12px] text-[#d0d6e0]">
                {detail.stock.market}
              </span>
            </div>
            <p className="text-[13px] text-[#8a8f98]">
              {detail.stock.status === "holding" ? "보유 종목" : "관심 종목"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] border border-[#23252a] bg-[#141516] px-3 py-2 text-[14px] text-[#f7f8f8] transition hover:border-[#5e6ad2]"
          >
            닫기
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[16px] border border-[#23252a] bg-[#0f1011] p-5">
            <p className="text-[12px] uppercase tracking-[0.16em] text-[#8a8f98]">현재가</p>
            <p className="mt-2 text-[28px] font-semibold tracking-[-0.04em]">
              {formatPrice(quote?.marketPrice ?? null, quote?.currency)}
            </p>
            {detail.stockQuoteError ? (
              <p className="mt-3 text-[13px] text-[#e5484d]">{detail.stockQuoteError}</p>
            ) : null}
          </div>
          <div className="rounded-[16px] border border-[#23252a] bg-[#0f1011] p-5">
            <p className="text-[12px] uppercase tracking-[0.16em] text-[#8a8f98]">등락률</p>
            <p
              className="mt-2 text-[28px] font-semibold tracking-[-0.04em]"
              style={{
                color: isPositive ? "#27a644" : isNegative ? "#e5484d" : "#f7f8f8",
              }}
            >
              {formatSignedPercent(changePercent)}
            </p>
          </div>
          <div className="rounded-[16px] border border-[#23252a] bg-[#0f1011] p-5">
            <p className="text-[12px] uppercase tracking-[0.16em] text-[#8a8f98]">52주 고가</p>
            <p className="mt-2 text-[22px] font-medium tracking-[-0.03em]">
              {formatPrice(quote?.fiftyTwoWeekHigh ?? null, quote?.currency)}
            </p>
          </div>
          <div className="rounded-[16px] border border-[#23252a] bg-[#0f1011] p-5">
            <p className="text-[12px] uppercase tracking-[0.16em] text-[#8a8f98]">52주 저가</p>
            <p className="mt-2 text-[22px] font-medium tracking-[-0.03em]">
              {formatPrice(quote?.fiftyTwoWeekLow ?? null, quote?.currency)}
            </p>
          </div>
        </div>

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
            {analysisError ? (
              <p className="text-[13px] text-[#e5484d]">{analysisError}</p>
            ) : null}
            {!analysis && !analysisError ? (
              <p className="text-[13px] text-[#8a8f98]">아직 분석 없음</p>
            ) : null}
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
          {detail.chartError ? (
            <div className="rounded-[16px] border border-[#23252a] bg-[#0f1011] px-5 py-8 text-[13px] text-[#e5484d]">
              {detail.chartError}
            </div>
          ) : (
            <StockChart isPending={isChartPending} points={filteredPoints} />
          )}
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <h3 className="text-[20px] font-medium tracking-[-0.03em]">최신 뉴스</h3>
            <p className="mt-1 text-[13px] text-[#8a8f98]">
              Google News RSS 기준 최신 5건입니다.
            </p>
          </div>
          <div className="rounded-[16px] border border-[#23252a] bg-[#0f1011]">
            {detail.newsError ? (
              <div className="px-5 py-6 text-[13px] text-[#e5484d]">{detail.newsError}</div>
            ) : detail.news.length === 0 ? (
              <div className="px-5 py-6 text-[13px] text-[#8a8f98]">뉴스가 없습니다.</div>
            ) : (
              detail.news.map((item) => (
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
          <div className="mb-4">
            <h3 className="text-[20px] font-medium tracking-[-0.03em]">최신 공시</h3>
            <p className="mt-1 text-[13px] text-[#8a8f98]">
              OpenDART 기준 최근 30일 내 최신 5건입니다.
            </p>
          </div>
          <div className="rounded-[16px] border border-[#23252a] bg-[#0f1011]">
            {detail.disclosuresError ? (
              <div className="px-5 py-6 text-[13px] text-[#e5484d]">
                {detail.disclosuresError}
              </div>
            ) : detail.disclosures.length === 0 ? (
              <div className="px-5 py-6 text-[13px] text-[#8a8f98]">공시가 없습니다.</div>
            ) : (
              detail.disclosures.map((item) => (
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
        </section>
      </aside>
    </div>
  );
}
