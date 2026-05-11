"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import type {
  LookupState,
  MutationResult,
} from "@/app/(routes)/stocks/action-types";
import { createClient } from "@/lib/supabase/server";
import { getStockLookup } from "@/lib/yahoo";

type StockStatus = "holding" | "watching";

function normalizeTicker(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toUpperCase();
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, error: "로그인 후 종목을 관리할 수 있습니다." };
  }

  return { supabase, user, error: null };
}

export async function lookupStockAction(
  _previousState: LookupState,
  formData: FormData,
): Promise<LookupState> {
  const ticker = normalizeTicker(formData.get("ticker"));

  if (!ticker) {
    return {
      lookup: null,
      message: "티커를 입력해 주세요.",
    };
  }

  const lookup = await getStockLookup(ticker);

  if (!lookup) {
    return {
      lookup: null,
      message: "존재하지 않는 티커입니다.",
    };
  }

  return {
    lookup,
    message: null,
  };
}

export async function createStockAction(formData: FormData): Promise<MutationResult> {
  const ticker = normalizeTicker(formData.get("ticker"));
  const status = String(formData.get("status") ?? "watching") as StockStatus;

  if (!ticker) {
    return {
      ok: false,
      message: "티커를 입력해 주세요.",
    };
  }

  const { supabase, user, error } = await requireUser();

  if (!user) {
    return {
      ok: false,
      message: error,
    };
  }

  const lookup = await getStockLookup(ticker);

  if (!lookup) {
    return {
      ok: false,
      message: "존재하지 않는 티커입니다.",
    };
  }

  const { data: existingStock } = await supabase
    .from("stocks")
    .select("id")
    .eq("user_id", user.id)
    .eq("ticker", lookup.ticker)
    .maybeSingle();

  if (existingStock) {
    return {
      ok: false,
      message: "이미 등록된 티커입니다.",
    };
  }

  const { error: insertError } = await supabase.from("stocks").insert({
    market: lookup.market,
    name: lookup.name,
    status,
    ticker: lookup.ticker,
    user_id: user.id,
  });

  if (insertError) {
    return {
      ok: false,
      message: insertError.code === "23505" ? "이미 등록된 티커입니다." : "종목 저장에 실패했습니다.",
    };
  }

  revalidatePath("/stocks");

  return {
    ok: true,
    message: "종목이 저장되었습니다.",
  };
}

export async function toggleStockStatusAction(formData: FormData): Promise<MutationResult> {
  const stockId = String(formData.get("stockId") ?? "");
  const currentStatus = String(formData.get("currentStatus") ?? "watching") as StockStatus;
  const nextStatus: StockStatus = currentStatus === "holding" ? "watching" : "holding";
  const { supabase, user, error } = await requireUser();

  if (!user) {
    return {
      ok: false,
      message: error,
    };
  }

  const { error: updateError } = await supabase
    .from("stocks")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", stockId)
    .eq("user_id", user.id);

  if (updateError) {
    return {
      ok: false,
      message: "상태 변경에 실패했습니다.",
    };
  }

  revalidatePath("/stocks");

  return {
    ok: true,
    message: nextStatus === "holding" ? "보유 종목으로 변경되었습니다." : "관심 종목으로 변경되었습니다.",
  };
}

export async function deleteStockAction(formData: FormData): Promise<MutationResult> {
  const stockId = String(formData.get("stockId") ?? "");
  const { supabase, user, error } = await requireUser();

  if (!user) {
    return {
      ok: false,
      message: error,
    };
  }

  const { error: deleteAnalysesError } = await supabase
    .from("analyses")
    .delete()
    .eq("stock_id", stockId);

  if (deleteAnalysesError) {
    return {
      ok: false,
      message: "연관 데이터 삭제에 실패했습니다.",
    };
  }

  const { error: deleteMemosError } = await supabase
    .from("memos")
    .delete()
    .eq("stock_id", stockId);

  if (deleteMemosError) {
    return {
      ok: false,
      message: "연관 데이터 삭제에 실패했습니다.",
    };
  }

  const { error: deleteStockError } = await supabase
    .from("stocks")
    .delete()
    .eq("id", stockId)
    .eq("user_id", user.id);

  if (deleteStockError) {
    return {
      ok: false,
      message: "종목 삭제에 실패했습니다.",
    };
  }

  revalidatePath("/stocks");

  return {
    ok: true,
    message: "종목이 삭제되었습니다.",
  };
}

function normalizeOptionalText(value: FormDataEntryValue | null): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalPositiveInt(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "")
    .replace(/,/g, "")
    .trim();
  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function saveMemoAction(formData: FormData): Promise<MutationResult> {
  const stockId = String(formData.get("stockId") ?? "");
  const buyReason = normalizeOptionalText(formData.get("buyReason"));
  const stopLoss = normalizeOptionalText(formData.get("stopLoss"));
  const targetPrice = formData.get("targetPrice");
  const targetPriceValue =
    targetPrice && String(targetPrice).trim() !== ""
      ? parseInt(String(targetPrice).trim(), 10)
      : null;
  const content = normalizeOptionalText(formData.get("content"));
  const shares = parseOptionalPositiveInt(formData.get("shares"));
  const avgPrice = parseOptionalPositiveInt(formData.get("avgPrice"));

  if (!stockId) {
    return {
      ok: false,
      message: "종목을 찾을 수 없습니다.",
    };
  }

  const { supabase, user, error } = await requireUser();

  if (!user) {
    return {
      ok: false,
      message: error,
    };
  }

  const { data: stock } = await supabase
    .from("stocks")
    .select("id")
    .eq("id", stockId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!stock) {
    return {
      ok: false,
      message: "분석 대상 종목을 찾을 수 없습니다.",
    };
  }

  const nowIso = new Date().toISOString();
  const memoPayload = {
    content: content ?? "",
    buy_reason: buyReason ?? "",
    stop_loss: stopLoss ?? "",
    target_price: targetPriceValue,
    shares,
    avg_price: avgPrice,
    updated_at: nowIso,
  };

  const { data: existingMemo } = await supabase
    .from("memos")
    .select("id")
    .eq("stock_id", stockId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMemo) {
    const { error: updateError } = await supabase
      .from("memos")
      .update(memoPayload)
      .eq("id", existingMemo.id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[saveMemoAction] memos update failed", updateError);
      return {
        ok: false,
        message: "메모 저장에 실패했습니다.",
      };
    }
  } else {
    const { error: insertError } = await supabase.from("memos").insert({
      stock_id: stockId,
      user_id: user.id,
      ...memoPayload,
      created_at: nowIso,
    });

    if (insertError) {
      console.error("[saveMemoAction] memos insert failed", insertError);
      return {
        ok: false,
        message: "메모 저장에 실패했습니다.",
      };
    }
  }

  revalidatePath("/stocks");

  return {
    ok: true,
    message: "투자 메모가 저장되었습니다.",
  };
}

export async function syncKoreanStockNamesAction(): Promise<MutationResult> {
  const { supabase, user, error } = await requireUser();

  if (!user) {
    return {
      ok: false,
      message: error,
    };
  }

  const { data: stocks, error: stocksError } = await supabase
    .from("stocks")
    .select("id, ticker, name")
    .eq("user_id", user.id);

  if (stocksError) {
    return {
      ok: false,
      message: "종목 목록을 불러오지 못했습니다.",
    };
  }

  const koreanTargets = (stocks ?? []).filter(
    (stock) =>
      /\.(KS|KQ)$/i.test(stock.ticker) &&
      !/[가-힣]/.test(stock.name) &&
      !stock.name.includes("("),
  );

  if (koreanTargets.length === 0) {
    return {
      ok: true,
      message: "동기화할 한글 종목명이 없습니다.",
    };
  }

  let krxTickerMap = new Map<string, string>();
  let krxCodeMap = new Map<string, string>();

  try {
    const filePath = path.join(process.cwd(), "public", "krx_stocks.json");
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Array<{ name?: string; ticker?: string }>;

    const normalizedRows = parsed.filter(
      (item): item is { code?: string; name: string; ticker?: string } => typeof item?.name === "string",
    );

    krxTickerMap = new Map(
      normalizedRows
        .filter((item) => typeof item.ticker === "string")
        .map((item) => [item.ticker!.toUpperCase(), item.name.trim()]),
    );

    krxCodeMap = new Map(
      normalizedRows
        .filter((item) => typeof item.code === "string")
        .map((item) => [item.code!.replace(/^0+/, "").toUpperCase(), item.name.trim()]),
    );
  } catch {
    return {
      ok: false,
      message: "KRX 종목 데이터 로드에 실패했습니다.",
    };
  }

  let updatedCount = 0;
  let nameMatchedCount = 0;

  for (const stock of koreanTargets) {
    try {
      const normalizedTicker = stock.ticker.toUpperCase();
      const stockCode = normalizedTicker.replace(/\.(KS|KQ)$/i, "").replace(/^0+/, "");
      const koreanName =
        krxTickerMap.get(normalizedTicker) ?? (stockCode ? krxCodeMap.get(stockCode.toUpperCase()) : null) ?? null;

      if (!koreanName || !/[가-힣]/.test(koreanName)) {
        continue;
      }
      nameMatchedCount += 1;

      const mergedName = `${koreanName} (${stock.name})`;
      const { error: updateError } = await supabase
        .from("stocks")
        .update({
          name: mergedName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", stock.id)
        .eq("user_id", user.id);

      if (!updateError) {
        updatedCount += 1;
      }
    } catch {
      continue;
    }
  }

  revalidatePath("/stocks");

  return {
    ok: true,
    message:
      updatedCount > 0
        ? `한글 종목명 동기화 완료: 대상 ${koreanTargets.length}개 중 ${updatedCount}개 업데이트`
        : nameMatchedCount > 0
          ? "한글명 매칭은 되었지만 업데이트에 실패했습니다. RLS/권한 정책을 확인해 주세요."
          : `동기화 가능한 한글 종목명을 찾지 못했습니다. (대상 ${koreanTargets.length}개)`,
  };
}
