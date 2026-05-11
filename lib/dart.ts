import type { DartDisclosure } from "@/types/stock";

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function getDartStockCode(ticker: string) {
  const normalized = ticker.toUpperCase().replace(/\.(KS|KQ)$/, "");
  return /^\d{6}$/.test(normalized) ? normalized : null;
}

export async function getDartDisclosures(ticker: string): Promise<DartDisclosure[]> {
  const stockCode = getDartStockCode(ticker);

  if (!stockCode) {
    return [];
  }

  const apiKey = process.env.DART_API_KEY;

  if (!apiKey) {
    throw new Error("DART_API_KEY가 설정되지 않았습니다.");
  }

  const from = new Date();
  from.setDate(from.getDate() - 30);

  const url = new URL("https://opendart.fss.or.kr/api/list.json");
  url.searchParams.set("crtfc_key", apiKey);
  url.searchParams.set("stock_code", stockCode);
  url.searchParams.set("bgn_de", formatDate(from));
  url.searchParams.set("page_count", "5");

  const response = await fetch(url.toString(), {
    next: {
      revalidate: 300,
    },
  });

  if (!response.ok) {
    throw new Error(`OpenDART 요청 실패: ${response.status}`);
  }

  const json = (await response.json()) as {
    list?: Array<{
      report_nm?: string;
      rcept_dt?: string;
      rcept_no?: string;
    }>;
    message?: string;
    status?: string;
  };

  if (json.status && json.status !== "000" && json.status !== "013") {
    throw new Error(json.message ?? "OpenDART 응답 오류");
  }

  return (json.list ?? []).slice(0, 5).map((item) => ({
    filedAt: item.rcept_dt ?? "",
    link: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no ?? ""}`,
    receiptNo: item.rcept_no ?? "",
    title: item.report_nm ?? "공시 제목 없음",
    type: item.report_nm?.split("(")[0]?.trim() ?? "공시",
  }));
}
