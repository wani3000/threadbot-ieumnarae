import { parseStringPromise } from "xml2js";
import type { Signal, Source } from "./types";

const RECRUIT_PATH_KEYS = ["/career/apply", "/career/recruit", "/career/recruitment", "/career/job", "/career/open"];
const THREADS_GRAPH_BASE = (process.env.THREADS_GRAPH_BASE || "https://graph.threads.net").replace(/\/$/, "");
const RELEVANCE_CORE = [
  "승무원",
  "객실승무원",
  "항공사",
  "채용",
  "모집",
  "면접",
  "서류",
  "자소서",
  "오픈데이",
  "cabin crew",
  "flight attendant",
  "recruit",
  "hiring",
];
const RELEVANCE_STRONG = ["대한항공", "아시아나", "제주항공", "진에어", "티웨이", "에어부산", "에어서울", "이스타", "에미레이트", "카타르", "에티하드"];

function looksLikeRecruitPath(url: string): boolean {
  const low = url.toLowerCase();
  return RECRUIT_PATH_KEYS.some((key) => low.includes(key));
}

function parseAirline(text: string): string | null {
  const low = text.toLowerCase();
  if (low.includes("koreanair") || low.includes("대한항공")) return "대한항공";
  if (low.includes("asiana") || low.includes("아시아나")) return "아시아나항공";
  return null;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function defaultThreadsQueries(): string[] {
  return [
    "승무원",
    "항공사채용",
    "꿀팁",
    "승무원꿀팁",
    "항공사채용꿀팁",
    "항공사면접꿀팁",
    "면접꿀팁",
    "승무원 면접",
    "승무원서류",
  ];
}

function expandThreadsQueries(baseQueries: string[]): string[] {
  const expanded = new Set<string>();
  for (const q of baseQueries) {
    const v = q.trim();
    if (!v) continue;
    expanded.add(v);
    expanded.add(`${v} 채용`);
    expanded.add(`${v} 면접`);
    expanded.add(`${v} 꿀팁`);
  }
  return [...expanded];
}

function relevanceScore(text: string, query: string): number {
  const low = text.toLowerCase();
  let score = 0;
  if (low.includes(query.toLowerCase())) score += 2;
  for (const key of RELEVANCE_CORE) {
    if (low.includes(key.toLowerCase())) score += 1;
  }
  for (const key of RELEVANCE_STRONG) {
    if (low.includes(key.toLowerCase())) score += 2;
  }
  return score;
}

function toConfidence(score: number): "high" | "medium" | "low" {
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  return "low";
}

export async function collectFromSource(source: Source, sinceIso: string): Promise<Signal[]> {
  const url = new URL(source.url);
  const sitemapUrl = `${url.protocol}//${url.host}/sitemap.xml`;
  const res = await fetchWithTimeout(sitemapUrl, { cache: "no-store" }, Number(process.env.SOURCE_FETCH_TIMEOUT_MS || "8000"));
  if (!res.ok) return [];

  const xml = await res.text();
  const parsed = await parseStringPromise(xml, { explicitArray: false, trim: true });
  const rows = parsed?.urlset?.url;
  if (!rows) return [];

  const list = Array.isArray(rows) ? rows : [rows];
  const since = new Date(sinceIso);

  return list
    .map((row: { loc?: string; lastmod?: string }) => {
      const loc = row.loc || "";
      const lastmod = row.lastmod || null;
      const published = lastmod ? new Date(lastmod) : null;
      return { loc, published };
    })
    .filter((row: { loc: string; published: Date | null }) => row.loc.includes("/career/") && looksLikeRecruitPath(row.loc))
    .filter((row: { loc: string; published: Date | null }) => !row.published || row.published >= since)
    .map((row: { loc: string; published: Date | null }) => {
      const pageName = row.loc.split("/").pop() || "apply";
      const title = `공식 채용 페이지 업데이트: ${pageName}`;
      const summary = "공식 채용 페이지가 갱신되었습니다. 모집요강/일정은 원문에서 확인하세요.";
      return {
        source_name: source.name,
        source_url: source.url,
        title,
        link: row.loc,
        published_at: row.published ? row.published.toISOString() : null,
        airline: parseAirline(`${source.name} ${source.url} ${row.loc}`),
        role: row.loc.toLowerCase().includes("cabin") ? "승무원" : null,
        summary,
        confidence: "high" as const,
      };
    });
}

export async function collectFromThreadsKeywords(sinceIso: string): Promise<Signal[]> {
  const token = process.env.THREADS_DISCOVERY_TOKEN || process.env.THREADS_PUBLISH_TOKEN || "";
  if (!token) return [];

  const queryText = process.env.THREADS_SEARCH_QUERIES || defaultThreadsQueries().join(",");
  const baseQueries = Array.from(
    new Set(
      queryText
        .split(",")
        .map((q) => q.trim())
        .filter(Boolean),
    ),
  );
  const expanded = expandThreadsQueries(baseQueries);
  const maxQueries = Number(process.env.THREADS_SEARCH_MAX_QUERIES || "12");
  const queries = expanded.slice(0, Math.max(1, Math.min(30, maxQueries)));
  if (queries.length === 0) return [];

  const limit = Number(process.env.THREADS_SEARCH_LIMIT || "25");
  const pages = Number(process.env.THREADS_SEARCH_PAGES || "1");
  const minScore = Number(process.env.THREADS_SEARCH_MIN_SCORE || "4");
  const until = new Date().toISOString();
  const items: Signal[] = [];

  for (const q of queries) {
    let after = "";
    for (let page = 0; page < Math.max(1, Math.min(5, pages)); page += 1) {
      const params = new URLSearchParams({
        q,
        search_type: "RECENT",
        search_mode: "KEYWORD",
        fields: "id,text,permalink,timestamp,username,topic_tag",
        since: sinceIso,
        until,
        limit: String(Math.max(1, Math.min(50, limit))),
      });
      if (after) params.set("after", after);
      const endpoint = `${THREADS_GRAPH_BASE}/keyword_search?${params.toString()}`;
      try {
        const res = await fetchWithTimeout(endpoint, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }, Number(process.env.THREADS_FETCH_TIMEOUT_MS || "7000"));
        if (!res.ok) break;
        const json = (await res.json().catch(() => ({}))) as {
          data?: Array<{
            id?: string;
            text?: string;
            permalink?: string;
            timestamp?: string;
            username?: string;
            topic_tag?: string;
          }>;
          paging?: {
            cursors?: { after?: string };
          };
        };
        for (const row of json.data || []) {
          const text = (row.text || "").trim();
          const score = relevanceScore(`${q} ${text}`, q);
          if (score < minScore) continue;
          const link =
            row.permalink?.trim() ||
            (row.username && row.id ? `https://www.threads.com/@${row.username}/post/${row.id}` : `https://www.threads.net/search?q=${encodeURIComponent(q)}`);
          const title = text ? `키워드(${q}) ${text.slice(0, 50)}` : `키워드 검색 결과: ${q}`;
          items.push({
            source_name: `threads-keyword:${q}`,
            source_url: `${THREADS_GRAPH_BASE}/keyword_search`,
            title,
            link,
            published_at: row.timestamp || null,
            airline: parseAirline(`${q} ${text}`),
            role: /승무원|cabin|flight attendant/i.test(`${q} ${text}`) ? "승무원" : null,
            summary: text || `Threads 키워드 검색(${q}) 결과입니다.`,
            confidence: toConfidence(score),
          });
        }
        after = json.paging?.cursors?.after || "";
        if (!after) break;
      } catch {
        break;
      }
    }
  }

  return items;
}

export function dedupeSignals(signals: Signal[]): Signal[] {
  const map = new Map<string, Signal>();
  for (const item of signals) {
    const key = `${item.title.toLowerCase().trim()}|${item.link.toLowerCase().trim()}`;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()].sort((a, b) => {
    const at = a.published_at ? new Date(a.published_at).getTime() : 0;
    const bt = b.published_at ? new Date(b.published_at).getTime() : 0;
    return bt - at;
  });
}

export function ongoingSignals(signals: Signal[]): Signal[] {
  return signals.filter((s) => /채용|모집|승무원|객실|recruit|hiring/i.test(`${s.title} ${s.summary}`));
}
