import type { NewsItem } from "@/types/stock";

function decodeHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseNewsItems(xml: string): NewsItem[] {
  const withPubMs = (xml.match(/<item>([\s\S]*?)<\/item>/g) ?? []).map((item) => {
    const titleMatch =
      item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) ??
      item.match(/<title>(.*?)<\/title>/i);
    const linkMatch = item.match(/<link>(.*?)<\/link>/i);
    const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/i);
    const sourceMatch = item.match(/<source[^>]*>(.*?)<\/source>/i);

    const publishedAt = decodeHtml((dateMatch?.[1] ?? "").trim());

    return {
      title: decodeHtml((titleMatch?.[1] ?? "").replace(/\s*-\s*Google 뉴스\s*$/i, "").trim()),
      link: decodeHtml((linkMatch?.[1] ?? "").trim()),
      publishedAt,
      source: decodeHtml((sourceMatch?.[1] ?? "").trim()) || "Google News",
      pubMs: Date.parse(publishedAt),
    };
  });

  const filtered = withPubMs.filter((item) => item.title && item.link);

  filtered.sort((a, b) => {
    const tb = Number.isFinite(b.pubMs) ? b.pubMs : 0;
    const ta = Number.isFinite(a.pubMs) ? a.pubMs : 0;
    return tb - ta;
  });

  return filtered.slice(0, 5).map(({ pubMs: _omit, ...news }) => news);
}

function getNewsQueries(name: string, ticker: string) {
  const normalizedName = name.trim();
  const normalizedTicker = ticker.trim().toUpperCase();
  const stockCode = normalizedTicker.replace(/\.(KS|KQ)$/, "");
  const hasHangul = /[가-힣]/.test(normalizedName);
  const isKoreanStockCode = /^\d{6}$/.test(stockCode);
  const queries = new Set<string>();

  if (isKoreanStockCode && !hasHangul) {
    queries.add(stockCode);
  }

  if (normalizedName) {
    queries.add(normalizedName);
  }

  if (isKoreanStockCode) {
    queries.add(stockCode);
  }

  return [...queries];
}

export async function getStockNews({
  name,
  ticker,
}: {
  name: string;
  ticker: string;
}): Promise<NewsItem[]> {
  for (const queryText of getNewsQueries(name, ticker)) {
    const query = encodeURIComponent(queryText);
    const url = `https://news.google.com/rss/search?q=${query}&hl=ko&gl=KR&ceid=KR:ko&sort=date`;
    const response = await fetch(url);
    const xml = await response.text();

    if (!response.ok) {
      throw new Error(`Google News RSS 요청 실패: ${response.status}`);
    }

    const items = parseNewsItems(xml);

    if (items.length > 0) {
      return items;
    }
  }

  return [];
}
