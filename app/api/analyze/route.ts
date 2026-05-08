import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getDartDisclosures } from "@/lib/dart";
import { getStockNews } from "@/lib/news";
import { createClient } from "@/lib/supabase/server";
import { getStockQuote } from "@/lib/yahoo";
import type { AnalysisOpinion } from "@/types/stock";

type AnalyzeBody = {
  stock_id?: string;
  ticker?: string;
  name?: string;
};

type ParsedReport = {
  summary: string;
  positives: string[];
  risks: string[];
  opinion: AnalysisOpinion;
};

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "알 수 없는 오류가 발생했습니다.";
}

function normalizeJsonText(value: string) {
  return value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
}

function normalizeList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0)
      .slice(0, 5);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return [value.trim()];
  }

  return [];
}

function parseOpinion(value: unknown): AnalysisOpinion {
  if (value === "매수" || value === "매도" || value === "관망") {
    return value;
  }

  return "관망";
}

function parseReport(rawText: string): ParsedReport {
  const parsed = JSON.parse(normalizeJsonText(rawText)) as {
    opinion?: unknown;
    positives?: unknown;
    risks?: unknown;
    summary?: unknown;
  };
  const toArray = (val: unknown): string[] => {
    if (Array.isArray(val)) {
      return val.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof val === "string") {
      return val
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  };

  parsed.positives = toArray(parsed.positives);
  parsed.risks = toArray(parsed.risks);

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    positives: normalizeList(parsed.positives),
    risks: normalizeList(parsed.risks),
    opinion: parseOpinion(parsed.opinion),
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = (await request.json()) as AnalyzeBody;
    const stockId = body.stock_id?.trim();
    const ticker = body.ticker?.trim().toUpperCase();
    const name = body.name?.trim();

    if (!stockId || !ticker || !name) {
      return NextResponse.json(
        { error: "stock_id, ticker, name을 모두 전달해 주세요." },
        { status: 400 },
      );
    }

    const { data: stock } = await supabase
      .from("stocks")
      .select("id")
      .eq("id", stockId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!stock) {
      return NextResponse.json({ error: "분석 대상 종목을 찾을 수 없습니다." }, { status: 404 });
    }

    const [quoteResult, newsResult, disclosuresResult] = await Promise.allSettled([
      getStockQuote(ticker),
      getStockNews({ name, ticker }),
      getDartDisclosures(ticker),
    ]);

    const quote = quoteResult.status === "fulfilled" ? quoteResult.value : null;
    const news = newsResult.status === "fulfilled" ? newsResult.value : [];
    const disclosures = disclosuresResult.status === "fulfilled" ? disclosuresResult.value : [];

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = [
      "당신은 한국어 주식 리서치 애널리스트다.",
      "아래 데이터를 바탕으로 투자 의견을 JSON으로만 응답하라.",
      '의견(opinion)은 반드시 "매수", "매도", "관망" 중 하나만 사용하라.',
      "",
      "[종목 정보]",
      `종목명: ${name}`,
      `티커: ${ticker}`,
      `현재가: ${quote?.marketPrice ?? "데이터 없음"} ${quote?.currency ?? ""}`.trim(),
      `등락률: ${quote?.marketChangePercent ?? "데이터 없음"}`,
      `52주 고가: ${quote?.fiftyTwoWeekHigh ?? "데이터 없음"}`,
      `52주 저가: ${quote?.fiftyTwoWeekLow ?? "데이터 없음"}`,
      "",
      "[최신 뉴스 5건]",
      ...(news.length > 0 ? news.map((item, index) => `${index + 1}. ${item.title}`) : ["데이터 없음"]),
      "",
      "[최신 공시 5건]",
      ...(disclosures.length > 0
        ? disclosures.map((item, index) => `${index + 1}. ${item.title}`)
        : ["데이터 없음"]),
      "",
      "[응답 형식]",
      "{",
      '  "summary": "현재 상황 한 문장 요약",',
      '  "positives": ["긍정 요인 1", "긍정 요인 2", "긍정 요인 3"],',
      '  "risks": ["리스크 요인 1", "리스크 요인 2", "리스크 요인 3"],',
      '  "opinion": "매수 또는 매도 또는 관망"',
      "}",
      'opinion은 반드시 "매수", "매도", "관망" 중 하나만 사용하라.',
      "positives와 risks는 반드시 문자열 배열(string[])로 반환하라.",
      "JSON 외 다른 텍스트 없이 JSON만 반환하라.",
    ].join("\n");

    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
    console.log("GEMINI RAW:", rawText);
    const report = parseReport(rawText);

    if (!report.summary) {
      return NextResponse.json({ error: "AI 응답 파싱에 실패했습니다." }, { status: 502 });
    }

    const { data: savedAnalysis, error: upsertError } = await supabase
      .from("analyses")
      .upsert(
        {
          stock_id: stockId,
          user_id: user.id,
          summary: report.summary,
          positives: report.positives,
          risks: report.risks,
          opinion: report.opinion,
          raw_response: rawText,
          created_at: new Date().toISOString(),
        },
        { onConflict: "stock_id" },
      )
      .select("summary, positives, risks, opinion, created_at")
      .single();

    if (upsertError || !savedAnalysis) {
      return NextResponse.json(
        { error: upsertError?.message ?? "분석 저장에 실패했습니다." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      result: {
        summary: savedAnalysis.summary ?? "",
        positives: savedAnalysis.positives ?? [],
        risks: savedAnalysis.risks ?? [],
        opinion: parseOpinion(savedAnalysis.opinion),
        createdAt: savedAnalysis.created_at,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}
