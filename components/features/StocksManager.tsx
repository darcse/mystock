"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LookupState } from "@/app/(routes)/stocks/action-types";
import { logoutAction } from "@/app/(routes)/login/actions";
import {
  createStockAction,
  deleteStockAction,
  lookupStockAction,
  toggleStockStatusAction,
} from "@/app/(routes)/stocks/actions";

type StockStatus = "holding" | "watching";

type StockItem = {
  id: string;
  ticker: string;
  name: string;
  market: string;
  status: StockStatus;
  createdAt: string;
  updatedAt: string;
};

type StocksManagerProps = {
  initialStocks: StockItem[];
  isAuthenticated: boolean;
};

const initialLookupState: LookupState = {
  lookup: null,
  message: null,
};

export function StocksManager({
  initialStocks,
  isAuthenticated,
}: StocksManagerProps) {
  const router = useRouter();
  const [ticker, setTicker] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<StockStatus>("watching");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [lookupState, lookupAction, isLookupPending] = useActionState(
    lookupStockAction,
    initialLookupState,
  );
  const [isPending, startTransition] = useTransition();
  const normalizedTicker = ticker.trim().toUpperCase();
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
    }
  }, [activeLookup, lookupState]);

  async function handleSave(status: StockStatus) {
    const formData = new FormData();
    formData.set("ticker", activeLookup?.ticker ?? ticker);
    formData.set("status", status);

    startTransition(async () => {
      const result = await createStockAction(formData);

      setFeedback(result.message);

      if (!result.ok) {
        return;
      }

      setTicker("");
      setSelectedStatus("watching");
      router.refresh();
    });
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

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
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
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-[8px] border border-[#23252a] bg-[#141516] px-3 py-2 text-[14px] font-medium text-[#f7f8f8] transition hover:border-[#5e6ad2] hover:text-white"
              >
                로그아웃
              </button>
            </form>
          ) : null}
        </div>
        {!isAuthenticated ? (
          <div className="rounded-[12px] border border-[#3e3e44] bg-[#141516] px-4 py-3 text-[13px] text-[#d0d6e0]">
            로그인 후 종목을 저장하고 상태를 변경할 수 있습니다.
          </div>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-[16px] border border-[#23252a] bg-[#0f1011] p-5 text-[#f7f8f8]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[20px] font-medium tracking-[-0.02em]">종목 추가</h2>
            <span className="rounded-full border border-[#23252a] bg-[#141516] px-2.5 py-1 text-[12px] text-[#8a8f98]">
              Yahoo Lookup
            </span>
          </div>

          <form action={lookupAction} className="flex flex-col gap-3">
            <label className="flex flex-col gap-2">
              <span className="text-[13px] text-[#d0d6e0]">티커 코드</span>
              <input
                name="ticker"
                value={ticker}
                onChange={(event) => setTicker(event.target.value.toUpperCase())}
                placeholder="예: AAPL, TSLA, 005930.KS"
                className="rounded-[8px] border border-[#23252a] bg-[#141516] px-3 py-2.5 text-[14px] text-[#f7f8f8] outline-none transition focus:border-[#5e6ad2] focus:ring-1 focus:ring-[#5e6ad2]"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[13px] text-[#d0d6e0]">기본 상태</span>
              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value as StockStatus)}
                className="rounded-[8px] border border-[#23252a] bg-[#141516] px-3 py-2.5 text-[14px] text-[#f7f8f8] outline-none transition focus:border-[#5e6ad2] focus:ring-1 focus:ring-[#5e6ad2]"
              >
                <option value="watching">관심</option>
                <option value="holding">보유</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={isLookupPending || !ticker.trim()}
              className="rounded-[8px] bg-[#5e6ad2] px-3 py-2.5 text-[14px] font-medium text-white transition hover:bg-[#828fff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLookupPending ? "조회 중..." : "티커 조회"}
            </button>
          </form>

          {activeLookup ? (
            <div className="mt-4 rounded-[12px] border border-[#23252a] bg-[#141516] p-4">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[12px] uppercase tracking-[0.2em] text-[#8a8f98]">
                  {activeLookup.ticker}
                </span>
                <strong className="text-[18px] font-medium tracking-[-0.02em]">
                  {activeLookup.name}
                </strong>
                <span className="text-[13px] text-[#d0d6e0]">{activeLookup.market}</span>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={!isAuthenticated || isPending}
                  onClick={() => handleSave(selectedStatus)}
                  className="flex-1 rounded-[8px] bg-[#5e6ad2] px-3 py-2.5 text-[14px] font-medium text-white transition hover:bg-[#828fff] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {selectedStatus === "holding" ? "보유로 저장" : "관심으로 저장"}
                </button>
              </div>
            </div>
          ) : null}

          {feedback ? (
            <p className="mt-4 text-[13px] leading-6 text-[#d0d6e0]">{feedback}</p>
          ) : null}
        </div>

        <div className="rounded-[16px] border border-[#23252a] bg-[#0f1011] p-5 text-[#f7f8f8]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[20px] font-medium tracking-[-0.02em]">등록된 종목</h2>
            <span className="rounded-full border border-[#23252a] bg-[#141516] px-2.5 py-1 text-[12px] text-[#8a8f98]">
              {initialStocks.length} items
            </span>
          </div>

          {hasStocks ? (
            <div className="grid gap-3">
              {initialStocks.map((stock) => {
                const isHolding = stock.status === "holding";

                return (
                  <article
                    key={stock.id}
                    className="flex flex-col gap-4 rounded-[16px] border border-[#23252a] bg-[#141516] p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[18px] font-medium tracking-[-0.02em]">
                          {stock.name}
                        </h3>
                        <span className="rounded-full border border-[#23252a] bg-[#010102] px-2.5 py-1 font-mono text-[12px] uppercase tracking-[0.16em] text-[#8a8f98]">
                          {stock.ticker}
                        </span>
                        <span
                          className="rounded-full px-2.5 py-1 text-[12px] font-medium"
                          style={{
                            backgroundColor: isHolding ? "rgba(39, 166, 68, 0.12)" : "rgba(94, 106, 210, 0.12)",
                            color: isHolding ? "#27a644" : "#828fff",
                          }}
                        >
                          {isHolding ? "보유" : "관심"}
                        </span>
                      </div>
                      <p className="text-[13px] text-[#d0d6e0]">{stock.market}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!isAuthenticated || isPending}
                        onClick={() => handleToggle(stock.id, stock.status)}
                        className="rounded-[8px] border border-[#23252a] bg-[#0f1011] px-3 py-2 text-[14px] font-medium text-[#f7f8f8] transition hover:border-[#5e6ad2] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isHolding ? "관심으로 변경" : "보유로 변경"}
                      </button>
                      <button
                        type="button"
                        disabled={!isAuthenticated || isPending}
                        onClick={() => handleDelete(stock.id, stock.name)}
                        className="rounded-[8px] border border-[#3e3e44] bg-[#0f1011] px-3 py-2 text-[14px] font-medium text-[#e5484d] transition hover:border-[#e5484d] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[16px] border border-dashed border-[#23252a] bg-[#141516] px-6 py-10 text-center">
              <p className="text-[15px] text-[#d0d6e0]">아직 등록된 종목이 없습니다.</p>
              <p className="mt-2 text-[13px] text-[#8a8f98]">
                왼쪽 패널에서 티커를 조회한 뒤 첫 종목을 추가해 보세요.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
