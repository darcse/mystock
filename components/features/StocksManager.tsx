"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogOut, RefreshCw, X } from "lucide-react";
import type { LookupState } from "@/app/(routes)/stocks/action-types";
import { logoutAction } from "@/app/(routes)/login/actions";
import {
  createStockAction,
  deleteStockAction,
  lookupStockAction,
  toggleStockStatusAction,
} from "@/app/(routes)/stocks/actions";
import { StockDrawer } from "@/components/features/StockDrawer";
import { createClient } from "@/lib/supabase/client";
import type { StockDashboardItem, StockDrawerDetail, StockLookup, StockStatus } from "@/types/stock";

type StocksManagerProps = {
  initialStocks: StockDashboardItem[];
  isAuthenticated: boolean;
  marketIndicesBar?: ReactNode;
  selectedDetail: StockDrawerDetail | null;
};

type DashboardFilter = "all" | "holding" | "watching";
type DashboardSort = "change" | "name" | "created" | "price";

const initialLookupState: LookupState = {
  lookup: null,
  message: null,
};

function waitMinimumSpinnerTime() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 300);
  });
}

export function StocksManager({
  initialStocks,
  isAuthenticated,
  marketIndicesBar,
  selectedDetail,
}: StocksManagerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ticker, setTicker] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<StockStatus>("watching");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [krxStocks, setKrxStocks] = useState<
    Array<{ name: string; market: string; code: string; ticker: string }>
  >([]);
  const [searchResults, setSearchResults] = useState<
    Array<{ name: string; market: string; code: string; ticker: string }>
  >([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [debouncedSearchInput, setDebouncedSearchInput] = useState("");
  const [selectedKrxStock, setSelectedKrxStock] = useState<{
    name: string;
    market: string;
    code: string;
    ticker: string;
  } | null>(null);
  const [localizedNames, setLocalizedNames] = useState<Record<string, string>>({});
  const [dashboardFilter, setDashboardFilter] = useState<DashboardFilter>("all");
  const [dashboardSort, setDashboardSort] = useState<DashboardSort>("change");
  const [isDashboardRefreshing, setIsDashboardRefreshing] = useState(false);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);
  const [isDrawerRefreshing, setIsDrawerRefreshing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [lookupState, lookupAction, isLookupPending] = useActionState(
    lookupStockAction,
    initialLookupState,
  );
  const [isPending, startTransition] = useTransition();
  const debounceTimerRef = useRef<number | null>(null);
  const pageContainerRef = useRef<HTMLElement | null>(null);
  const tickerInputRef = useRef<HTMLInputElement | null>(null);
  const hasBlockedInitialTickerFocusRef = useRef(false);
  const normalizedTicker = ticker.trim().toUpperCase();
  const selectedTickerInQuery = searchParams.get("ticker")?.trim().toUpperCase() ?? null;
  const activeLookup =
    lookupState.lookup && lookupState.lookup.ticker === normalizedTicker
      ? lookupState.lookup
      : null;

  useEffect(() => {
    if (lookupState.message) {
      setFeedback(lookupState.message);
      return;
    }

    if (activeLookup) {
      setFeedback(null);
      setIsSearchOpen(false);
      setSearchResults([]);
    }
  }, [activeLookup, lookupState]);

  useEffect(() => {
    if (!selectedKrxStock) {
      return;
    }

    if (selectedKrxStock.ticker !== normalizedTicker) {
      setSelectedKrxStock(null);
    }
  }, [normalizedTicker, selectedKrxStock]);

  useEffect(() => {
    let cancelled = false;

    fetch("/krx_stocks.json")
      .then((response) => response.json())
      .then((json) => {
        if (cancelled) {
          return;
        }

        const rows = Array.isArray(json)
          ? json.filter(
              (item): item is { name: string; market: string; code: string; ticker: string } =>
                Boolean(
                  item &&
                    typeof item === "object" &&
                    typeof item.name === "string" &&
                    typeof item.market === "string" &&
                    typeof item.code === "string" &&
                    typeof item.ticker === "string",
                ),
            )
          : [];

        setKrxStocks(rows);
      })
      .catch(() => {
        if (!cancelled) {
          setKrxStocks([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const koreanTickers = initialStocks
      .map((stock) => stock.ticker)
      .filter((ticker) => /\.(KS|KQ)$/i.test(ticker));

    const missing = koreanTickers.filter((ticker) => !localizedNames[ticker]);

    if (missing.length === 0 || krxStocks.length === 0) {
      return;
    }

    const krxNameByTicker = new Map(
      krxStocks
        .filter((item) => /[가-힣]/.test(item.name))
        .map((item) => [item.ticker.toUpperCase(), item.name]),
    );

    const next: Record<string, string> = {};
    for (const ticker of missing) {
      const mapped = krxNameByTicker.get(ticker.toUpperCase());
      if (mapped) {
        next[ticker] = mapped;
      }
    }
    if (Object.keys(next).length > 0) {
      setLocalizedNames((prev) => ({ ...prev, ...next }));
    }
  }, [initialStocks, krxStocks, localizedNames]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const trimmed = ticker.trim();
    if (!trimmed) {
      setDebouncedSearchInput("");
      return;
    }

    debounceTimerRef.current = window.setTimeout(() => {
      setDebouncedSearchInput(trimmed);
      debounceTimerRef.current = null;
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [ticker]);

  useEffect(() => {
    if (selectedTickerInQuery) {
      return;
    }

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    setDebouncedSearchInput("");
    setSearchResults([]);
    setIsSearchOpen(false);
  }, [selectedTickerInQuery]);

  useEffect(() => {
    if (!debouncedSearchInput) {
      setSearchResults([]);
      setIsSearchOpen(false);
      return;
    }

    const query = debouncedSearchInput;
    const upperQuery = query.toUpperCase();
    const results = krxStocks
      .filter(
        (item) =>
          item.name.includes(query) ||
          item.code.includes(query) ||
          item.ticker.toUpperCase().includes(upperQuery),
      )
      .slice(0, 8);

    setSearchResults(results);
    setIsSearchOpen(true);
  }, [debouncedSearchInput, krxStocks]);

  useEffect(() => {
    if (!selectedTickerInQuery) {
      setIsDrawerLoading(false);
      return;
    }

    if (selectedDetail?.stock.ticker === selectedTickerInQuery) {
      setIsDrawerLoading(false);
    }
  }, [selectedDetail?.stock.ticker, selectedTickerInQuery]);

  // selectedDetail이 서버에서 null로 확정되면 isDrawerOpen도 닫힘으로 동기화
  useEffect(() => {
    if (!selectedDetail) {
      setIsDrawerOpen(false);
    }
  }, [selectedDetail]);

  async function handleSave(status: StockStatus) {
    const formData = new FormData();
    formData.set("ticker", activeLookup?.ticker ?? ticker);
    formData.set("status", status);

    startTransition(async () => {
      const normalizedSaveTicker = (activeLookup?.ticker ?? ticker).trim().toUpperCase();
      const shouldSaveWithKrxName =
        Boolean(selectedKrxStock) &&
        selectedKrxStock?.ticker.toUpperCase() === normalizedSaveTicker &&
        Boolean(activeLookup);

      if (shouldSaveWithKrxName && selectedKrxStock && activeLookup) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setFeedback("로그인 후 종목을 관리할 수 있습니다.");
          return;
        }

        const { data: existingStock } = await supabase
          .from("stocks")
          .select("id")
          .eq("user_id", user.id)
          .eq("ticker", normalizedSaveTicker)
          .maybeSingle();

        if (existingStock) {
          setFeedback("이미 등록된 티커입니다.");
          return;
        }

        const mergedName = `${selectedKrxStock.name} (${activeLookup.name})`;
        const { error } = await supabase.from("stocks").insert({
          market: activeLookup.market,
          name: mergedName,
          status,
          ticker: normalizedSaveTicker,
          user_id: user.id,
        });

        if (error) {
          setFeedback(error.code === "23505" ? "이미 등록된 티커입니다." : "종목 저장에 실패했습니다.");
          return;
        }

        setFeedback("종목이 저장되었습니다.");
        setTicker("");
        setSelectedKrxStock(null);
        setSelectedStatus("watching");
        router.refresh();
        return;
      }

      const result = await createStockAction(formData);

      setFeedback(result.message);

      if (!result.ok) {
        return;
      }

      setTicker("");
      setSelectedKrxStock(null);
      setSelectedStatus("watching");
      router.refresh();
    });
  }

  function runLookup(nextTicker: string) {
    const normalized = nextTicker.trim().toUpperCase();

    if (!normalized) {
      setFeedback("티커를 입력해 주세요.");
      return;
    }

    const formData = new FormData();
    formData.set("ticker", normalized);

    startTransition(async () => {
      try {
        const result = (await lookupAction(formData)) as unknown as {
          lookup: StockLookup | null;
          message?: string | null;
          error?: string;
        };

        if (!result?.lookup) {
          setFeedback("종목을 찾을 수 없습니다.");
          return;
        }

        setFeedback(result.message ?? null);
      } catch {
        setFeedback("종목을 찾을 수 없습니다.");
      }
    });
  }

  function handleLookupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const inputTicker = String(formData.get("ticker") ?? "");
    runLookup(inputTicker);
  }

  async function handleToggle(stockId: string, currentStatus: StockStatus) {
    const formData = new FormData();
    formData.set("stockId", stockId);
    formData.set("currentStatus", currentStatus);

    startTransition(async () => {
      const result = await toggleStockStatusAction(formData);
      setFeedback(result.message);

      if (result.ok) {
        router.refresh();
      }
    });
  }

  async function handleDelete(stockId: string, stockName: string) {
    const isConfirmed = window.confirm(`${stockName} 종목을 삭제할까요?`);

    if (!isConfirmed) {
      return;
    }

    const formData = new FormData();
    formData.set("stockId", stockId);

    startTransition(async () => {
      const result = await deleteStockAction(formData);
      setFeedback(result.message);

      if (result.ok) {
        router.refresh();
      }
    });
  }

  const hasStocks = initialStocks.length > 0;

  const filteredAndSortedStocks = useMemo(() => {
    const filtered = initialStocks.filter((stock) => {
      if (dashboardFilter === "all") {
        return true;
      }
      return stock.status === dashboardFilter;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (dashboardSort === "change") {
        const aValue = a.quote?.marketChangePercent ?? Number.NEGATIVE_INFINITY;
        const bValue = b.quote?.marketChangePercent ?? Number.NEGATIVE_INFINITY;
        return bValue - aValue;
      }

      if (dashboardSort === "name") {
        const aName = (localizedNames[a.ticker] ?? a.name).replace(/\s*\(.*?\)\s*$/, "");
        const bName = (localizedNames[b.ticker] ?? b.name).replace(/\s*\(.*?\)\s*$/, "");
        return aName.localeCompare(bName, "ko");
      }

      if (dashboardSort === "created") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      const aPrice = a.quote?.marketPrice ?? Number.NEGATIVE_INFINITY;
      const bPrice = b.quote?.marketPrice ?? Number.NEGATIVE_INFINITY;
      return bPrice - aPrice;
    });

    return sorted;
  }, [dashboardFilter, dashboardSort, initialStocks, localizedNames]);

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

  function formatChangePercent(value: number | null) {
    if (value === null) {
      return "--";
    }

    return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
  }

  function updateDrawerTicker(nextTicker: string | null) {
    setSelectedTicker(nextTicker);
    if (nextTicker) {
      setIsDrawerOpen(true);
      setIsDrawerLoading(true);
    } else {
      setIsDrawerOpen(false);
      setIsDrawerLoading(false);
      setIsDrawerRefreshing(false);
    }

    const params = new URLSearchParams(searchParams.toString());

    if (nextTicker) {
      params.set("ticker", nextTicker);
    } else {
      params.delete("ticker");
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  function handleDashboardRefresh() {
    setIsDashboardRefreshing(true);
    startTransition(() => {
      void Promise.all([
        Promise.resolve(router.refresh()),
        waitMinimumSpinnerTime(),
      ]).finally(() => {
        setIsDashboardRefreshing(false);
      });
    });
  }

  function handleDrawerRefresh() {
    setIsDrawerRefreshing(true);
    startTransition(() => {
      void Promise.all([
        Promise.resolve(router.refresh()),
        waitMinimumSpinnerTime(),
      ]).finally(() => {
        setIsDrawerRefreshing(false);
      });
    });
  }

  return (
    <section
      ref={pageContainerRef}
      tabIndex={-1}
      className="mx-auto flex w-full max-w-7xl flex-col gap-6 focus:outline-none"
    >
      <header className="flex flex-col gap-3 rounded-[24px] border border-[#23252a] bg-[#0f1011] p-6 text-[#f7f8f8] shadow-[0_0_0_1px_rgba(255,255,255,0.01)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-medium uppercase tracking-[0.28em] text-[#8a8f98]">
              Stock Registry
            </span>
            <h1 className="text-[28px] font-semibold tracking-[-0.03em]">
              보유·관심 종목 관리
            </h1>
            <p className="max-w-3xl text-[14px] leading-6 text-[#d0d6e0]">
              티커를 조회해 기업명과 시장 정보를 확인한 뒤 종목을 저장하고, 보유 상태와 삭제를 바로 관리할 수 있습니다.
            </p>
          </div>
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="새로고침"
                onClick={handleDashboardRefresh}
                className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#23252a] bg-[#141516] text-[#f7f8f8] transition hover:border-[#5e6ad2]"
              >
                {isDashboardRefreshing ? (
                  <Loader2 size={18} className="animate-spin text-[#5e6ad2]" />
                ) : (
                  <RefreshCw size={18} />
                )}
              </button>
              <form action={logoutAction}>
                <button
                  type="submit"
                  aria-label="로그아웃"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#23252a] bg-[#141516] text-[#f7f8f8] transition hover:border-[#5e6ad2]"
                >
                  <LogOut size={18} />
                </button>
              </form>
            </div>
          ) : null}
        </div>
        {!isAuthenticated ? (
          <div className="rounded-[12px] border border-[#3e3e44] bg-[#141516] px-4 py-3 text-[13px] text-[#d0d6e0]">
            로그인 후 종목을 저장하고 상태를 변경할 수 있습니다.
          </div>
        ) : null}
      </header>

      {marketIndicesBar}

      <div className="rounded-[16px] border border-[#23252a] bg-[#0f1011] p-5 text-[#f7f8f8]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative flex min-w-[220px] flex-1 flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] uppercase tracking-[0.16em] text-[#8a8f98]">종목 추가</span>
                <a
                  href="https://www.ktb.co.kr/trading/popup/itemPop.jspx"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12px] text-[#8a8f98] transition hover:text-[#d0d6e0]"
                >
                  종목코드 조회 ↗
                </a>
              </div>
              <input
                ref={tickerInputRef}
                name="ticker"
                value={ticker}
                onChange={(event) => setTicker(event.target.value.toUpperCase())}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    runLookup(ticker);
                  }
                }}
                onFocus={(event) => {
                  if (!hasBlockedInitialTickerFocusRef.current) {
                    hasBlockedInitialTickerFocusRef.current = true;
                    event.currentTarget.blur();
                    pageContainerRef.current?.focus({ preventScroll: true });
                    return;
                  }

                  setIsSearchOpen(true);
                }}
                onBlur={() => window.setTimeout(() => setIsSearchOpen(false), 120)}
                placeholder="티커 입력 (예: 005930.KS, AAPL)"
                className="h-11 rounded-[10px] border border-[#23252a] bg-[#141516] px-3 pr-10 text-[14px] text-[#f7f8f8] outline-none transition focus:border-[#5e6ad2] focus:ring-1 focus:ring-[#5e6ad2]"
              />
              {ticker.trim() ? (
                <button
                  type="button"
                  aria-label="검색어 지우기"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setTicker("");
                    setSearchResults([]);
                    setSelectedKrxStock(null);
                  }}
                  className="absolute right-2 top-[39px] inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[#8a8f98] transition hover:bg-[#23252a] hover:text-[#f7f8f8]"
                >
                  <X size={14} />
                </button>
              ) : null}
              {isSearchOpen ? (
                <div className="absolute top-[78px] z-20 w-full overflow-hidden rounded-[12px] border border-[#23252a] bg-[#18191a] shadow-[0_18px_60px_rgba(0,0,0,0.5)]">
                  {isLookupPending ? (
                    <div className="px-4 py-3 text-[13px] text-[#8a8f98]">조회 중...</div>
                  ) : !ticker.trim() ? (
                    <div className="px-4 py-3 text-[13px] text-[#8a8f98]">
                      종목명 또는 종목코드를 입력해 주세요.
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((item) => (
                      <button
                        key={`${item.code}-${item.ticker}`}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setTicker(item.ticker);
                          setSelectedKrxStock(item);
                          setIsSearchOpen(false);
                          const formData = new FormData();
                          formData.set("ticker", item.ticker);
                          startTransition(() => {
                            lookupAction(formData);
                          });
                        }}
                        className="flex w-full flex-col gap-1 border-b border-[#23252a] px-4 py-3 text-left transition hover:bg-[#141516] last:border-b-0"
                      >
                        <span className="text-[14px] text-[#f7f8f8]">{item.name}</span>
                        <span className="text-[12px] text-[#8a8f98]">
                          {item.code} · {item.market}
                        </span>
                        <span className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#8a8f98]">
                          {item.ticker}
                        </span>
                      </button>
                    ))
                  ) : null
                  }
                </div>
              ) : null}
            </div>

            <form onSubmit={handleLookupSubmit} className="flex items-end gap-2">
              <input type="hidden" name="ticker" value={ticker} />
              <button
                type="submit"
                disabled={isLookupPending || !ticker.trim()}
                className="h-11 rounded-[10px] bg-[#5e6ad2] px-4 text-[14px] font-medium text-white transition hover:bg-[#828fff] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLookupPending ? "조회 중..." : "조회"}
              </button>
            </form>
          </div>

          {activeLookup ? (
            <div className="flex flex-col gap-3 rounded-[14px] border border-[#23252a] bg-[#141516] px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[12px] uppercase tracking-[0.2em] text-[#8a8f98]">
                    {activeLookup.ticker}
                  </span>
                  <strong className="text-[18px] font-medium tracking-[-0.02em]">{activeLookup.name}</strong>
                  <span className="text-[13px] text-[#d0d6e0]">{activeLookup.market}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-full border border-[#23252a] bg-[#0f1011] p-1">
                    <button
                      type="button"
                      onClick={() => setSelectedStatus("watching")}
                      className={`rounded-full px-3 py-2 text-[13px] font-medium transition ${
                        selectedStatus === "watching" ? "bg-[#141516] text-[#f7f8f8]" : "text-[#8a8f98]"
                      }`}
                    >
                      관심
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStatus("holding")}
                      className={`rounded-full px-3 py-2 text-[13px] font-medium transition ${
                        selectedStatus === "holding" ? "bg-[#141516] text-[#f7f8f8]" : "text-[#8a8f98]"
                      }`}
                    >
                      보유
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={!isAuthenticated || isPending}
                    onClick={() => handleSave(selectedStatus)}
                    className="h-10 rounded-[10px] bg-[#5e6ad2] px-4 text-[14px] font-medium text-white transition hover:bg-[#828fff] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {selectedStatus === "holding" ? "보유로 저장" : "관심으로 저장"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {feedback ? <p className="text-[13px] leading-6 text-[#d0d6e0]">{feedback}</p> : null}
        </div>
      </div>

      <div className="rounded-[16px] border border-[#23252a] bg-[#0f1011] p-5 text-[#f7f8f8]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[20px] font-medium tracking-[-0.02em]">종목 대시보드</h2>
            <span className="rounded-full border border-[#23252a] bg-[#141516] px-2.5 py-1 text-[12px] text-[#8a8f98]">
              {filteredAndSortedStocks.length} items
            </span>
          </div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-full border border-[#23252a] bg-[#141516] p-1">
              <button
                type="button"
                onClick={() => setDashboardFilter("all")}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                  dashboardFilter === "all" ? "bg-[#0f1011] text-[#f7f8f8]" : "text-[#8a8f98]"
                }`}
              >
                전체
              </button>
              <button
                type="button"
                onClick={() => setDashboardFilter("holding")}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                  dashboardFilter === "holding" ? "bg-[#0f1011] text-[#f7f8f8]" : "text-[#8a8f98]"
                }`}
              >
                보유
              </button>
              <button
                type="button"
                onClick={() => setDashboardFilter("watching")}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                  dashboardFilter === "watching" ? "bg-[#0f1011] text-[#f7f8f8]" : "text-[#8a8f98]"
                }`}
              >
                관심
              </button>
            </div>
            <label className="flex items-center gap-2 text-[12px] text-[#8a8f98]">
              정렬
              <select
                value={dashboardSort}
                onChange={(event) => setDashboardSort(event.target.value as DashboardSort)}
                className="h-8 rounded-full border border-[#23252a] bg-[#141516] px-3 text-[12px] text-[#f7f8f8] outline-none transition focus:border-[#5e6ad2]"
              >
                <option value="change">등락률순</option>
                <option value="name">이름순</option>
                <option value="created">등록순</option>
                <option value="price">현재가순</option>
              </select>
            </label>
          </div>

          {hasStocks ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {filteredAndSortedStocks.map((stock) => {
                const isHolding = stock.status === "holding";
                const changePercent = stock.quote?.marketChangePercent ?? null;
                const isPositive = (changePercent ?? 0) > 0;
                const isNegative = (changePercent ?? 0) < 0;
                const rawDisplayName = localizedNames[stock.ticker] ?? stock.name;
                const displayName = rawDisplayName.replace(/\s*\(.*?\)\s*$/, "");

                return (
                  <article
                    key={stock.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => updateDrawerTicker(stock.ticker)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        updateDrawerTicker(stock.ticker);
                      }
                    }}
                    className="cursor-pointer rounded-[20px] border bg-[#141516] p-5 transition hover:-translate-y-0.5 hover:border-[#34343a] hover:bg-[#18191a] focus:outline-none focus:ring-1 focus:ring-[#5e6ad2]"
                    style={{
                      borderColor: isHolding ? "#27a644" : "#23252a",
                      boxShadow: isHolding
                        ? "0 0 0 1px rgba(39, 166, 68, 0.08)"
                        : "0 0 0 1px rgba(255,255,255,0.01)",
                    }}
                  >
                    <div className="flex h-full min-h-[248px] flex-col gap-3">
                      <div className="flex min-h-[72px] items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex min-h-[30px] items-center gap-2">
                            <h3 className="line-clamp-1 text-[20px] font-medium tracking-[-0.03em]">
                              {displayName}
                            </h3>
                          </div>
                          <p className="mt-1 line-clamp-1 min-h-[18px] font-mono text-[12px] uppercase tracking-[0.16em] text-[#8a8f98]">
                            {stock.ticker}
                          </p>
                        </div>
                        <span
                          className="inline-flex min-h-[28px] min-w-[44px] items-center justify-center rounded-full px-2.5 py-1 text-[12px] font-medium"
                          style={{
                            backgroundColor: isHolding
                              ? "rgba(39, 166, 68, 0.12)"
                              : "rgba(94, 106, 210, 0.12)",
                            color: isHolding ? "#27a644" : "#828fff",
                          }}
                        >
                          {isHolding ? "보유" : "관심"}
                        </span>
                      </div>

                      <div className="grid grid-cols-10 gap-2">
                        <div className="col-span-6 rounded-[16px] border border-[#23252a] bg-[#0f1011] px-4 py-3">
                          <p className="text-[12px] uppercase tracking-[0.16em] text-[#8a8f98]">
                            현재가
                          </p>
                          <p className="mt-2 min-h-[30px] truncate text-[18px] font-medium tracking-[-0.02em] text-[#f7f8f8]">
                            {formatPrice(stock.quote?.marketPrice ?? null, stock.quote?.currency)}
                          </p>
                        </div>
                        <div className="col-span-4 rounded-[16px] border border-[#23252a] bg-[#0f1011] px-3 py-3">
                          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8a8f98]">
                            등락률
                          </p>
                          <p
                            className="mt-2 min-h-[30px] whitespace-nowrap text-[16px] font-medium tracking-[-0.01em]"
                            style={{
                              color: isPositive
                                ? "#27a644"
                                : isNegative
                                  ? "#e5484d"
                                  : "#f7f8f8",
                            }}
                          >
                            {formatChangePercent(changePercent)}
                          </p>
                        </div>
                      </div>

                      <div
                        className="mt-auto flex flex-wrap gap-2"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          disabled={!isAuthenticated || isPending}
                          onClick={() => handleToggle(stock.id, stock.status)}
                          className="inline-flex h-10 min-h-[40px] items-center justify-center rounded-[8px] border border-[#23252a] bg-[#0f1011] px-3 text-[14px] font-medium leading-none text-[#f7f8f8] transition hover:border-[#5e6ad2] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isHolding ? "관심으로 변경" : "보유로 변경"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[16px] border border-dashed border-[#23252a] bg-[#141516] px-6 py-10 text-center">
              <p className="text-[15px] text-[#d0d6e0]">아직 등록된 종목이 없습니다.</p>
              <p className="mt-2 text-[13px] text-[#8a8f98]">
                왼쪽 패널에서 티커를 조회한 뒤 첫 종목을 추가하면 카드 대시보드가 여기에 표시됩니다.
              </p>
            </div>
          )}
          {hasStocks && filteredAndSortedStocks.length === 0 ? (
            <div className="mt-4 rounded-[16px] border border-dashed border-[#23252a] bg-[#141516] px-6 py-8 text-center">
              <p className="text-[14px] text-[#d0d6e0]">선택한 필터에 해당하는 종목이 없습니다.</p>
            </div>
          ) : null}
        </div>

      <StockDrawer
        detail={selectedDetail?.stock.ticker === selectedTicker ? selectedDetail : null}
        isOpen={isDrawerOpen}
        onClose={() => updateDrawerTicker(null)}
        onDelete={handleDelete}
        onRefresh={handleDrawerRefresh}
        isQuoteRefreshing={isDrawerRefreshing}
      />
      {isDrawerLoading && selectedDetail?.stock.ticker !== selectedTicker ? (
        <div className="pointer-events-none fixed inset-0 z-[55] flex justify-end">
          <div className="h-full w-full max-w-[760px] border-l border-[#23252a] bg-[#010102]/96 p-6">
            <div className="flex h-full items-center justify-center">
              <Loader2 size={28} className="animate-spin text-[#5e6ad2]" />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
