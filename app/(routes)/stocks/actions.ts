"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStockLookup, type StockLookup } from "@/lib/yahoo";

type StockStatus = "holding" | "watching";

export type LookupState = {
  lookup: StockLookup | null;
  message: string | null;
};

export type MutationResult = {
  ok: boolean;
  message: string | null;
};

export const initialLookupState: LookupState = {
  lookup: null,
  message: null,
};

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
    .eq("stock_id", stockId)
    .eq("user_id", user.id);

  if (deleteAnalysesError) {
    return {
      ok: false,
      message: "연관 데이터 삭제에 실패했습니다.",
    };
  }

  const { error: deleteMemosError } = await supabase
    .from("memos")
    .delete()
    .eq("stock_id", stockId)
    .eq("user_id", user.id);

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
