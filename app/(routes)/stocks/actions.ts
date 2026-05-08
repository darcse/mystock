"use server";

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

export async function saveMemoAction(formData: FormData): Promise<MutationResult> {
  const stockId = String(formData.get("stockId") ?? "");
  const buyReason = normalizeOptionalText(formData.get("buyReason"));
  const stopLoss = normalizeOptionalText(formData.get("stopLoss"));
  const targetPrice = normalizeOptionalText(formData.get("targetPrice"));
  const content = normalizeOptionalText(formData.get("content"));

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

  const { error: upsertError } = await supabase
    .from("memos")
    .upsert(
      {
        stock_id: stockId,
        user_id: user.id,
        content,
        buy_reason: buyReason,
        stop_loss: stopLoss,
        target_price: targetPrice,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stock_id" },
    );

  if (upsertError) {
    return {
      ok: false,
      message: "메모 저장에 실패했습니다.",
    };
  }

  revalidatePath("/stocks");

  return {
    ok: true,
    message: "투자 메모가 저장되었습니다.",
  };
}
