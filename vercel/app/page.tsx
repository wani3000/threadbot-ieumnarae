import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import type { Signal } from "@/lib/types";
import SourceManager from "@/components/SourceManager";
import { isOfficialRecruitSource } from "@/lib/sourceClassify";

export const dynamic = "force-dynamic";

function kstDate(offsetDays = 0): string {
  const now = new Date();
  const kstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  kstNow.setDate(kstNow.getDate() + offsetDays);
  return kstNow.toISOString().slice(0, 10);
}

async function getHomeData() {
  const db = supabaseAdmin();
  const tomorrow = kstDate(1);
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const weekAgoIso = weekAgo.toISOString();

  const [{ data: posts }, { data: drafts }, { data: signals }, { data: sources }, { data: tomorrowDraft }] = await Promise.all([
    db.from("posts").select("posted_at,post").gte("posted_at", weekAgoIso).order("posted_at", { ascending: false }).limit(10),
    db.from("drafts").select("draft_date,post,status,approved,updated_at").order("draft_date", { ascending: false }).limit(5),
    db.from("signals").select("source_name,title,link,summary,published_at,airline,role,confidence").gte("created_at", weekAgoIso).order("published_at", { ascending: false }).limit(200),
    db.from("sources").select("name,url,enabled").order("created_at", { ascending: true }),
    db.from("drafts").select("draft_date,post,status,approved,updated_at,source_json").eq("draft_date", tomorrow).maybeSingle(),
  ]);

  return {
    tomorrow,
    posts: posts || [],
    drafts: drafts || [],
    signals: (signals || []) as Signal[],
    sources: sources || [],
    tomorrowDraft: tomorrowDraft || null,
  };
}

function recommended(signals: Signal[]) {
  return signals.slice(0, 5).map((s) => ({
    title: s.title,
    post: `[이번 주 취업 체크]\n${s.title}\n\n핵심: ${s.summary}\n원문: ${s.link}`,
  }));
}

function seriesRecommended(signals: Signal[]) {
  const top = signals.slice(0, 3);
  if (top.length === 0) return [];
  return [
    {
      title: "연속 글 3편 구조 (시리즈)",
      posts: top.map((s, idx) => ({
        label: `${idx + 1}편`,
        post: `[${idx + 1}/3]\n주제: ${s.title}\n핵심: ${s.summary}\n원문: ${s.link}`,
      })),
    },
  ];
}

function ongoing(signals: Signal[]) {
  return signals.filter((s) => /채용|모집|승무원|객실|recruit|hiring/i.test(`${s.title} ${s.summary}`)).slice(0, 20);
}

function summarizeCollected(signals: Signal[]) {
  const airlineCount = new Map<string, number>();
  for (const s of signals) {
    const key = s.airline || "기타";
    airlineCount.set(key, (airlineCount.get(key) || 0) + 1);
  }
  const airlines = [...airlineCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topItems = signals.slice(0, 8);
  return { total: signals.length, airlines, topItems };
}

function sourcePriorityCounts(signals: Signal[]) {
  let threads = 0;
  let naver = 0;
  let official = 0;
  for (const s of signals) {
    const src = { name: s.source_name || "", url: s.source_url || "" };
    const low = `${src.name} ${src.url}`.toLowerCase();
    if (s.source_name?.startsWith("threads-keyword:") || low.includes("threads.com")) {
      threads += 1;
      continue;
    }
    if (low.includes("blog.naver.com") || low.includes("rss.blog.naver.com")) {
      naver += 1;
      continue;
    }
    if (isOfficialRecruitSource(src)) {
      official += 1;
    }
  }
  return { threads, naver, official };
}

function keywordStats(signals: Signal[]) {
  const map = new Map<string, { count: number; top: Signal[] }>();
  for (const s of signals) {
    if (!s.source_name?.startsWith("threads-keyword:")) continue;
    const keyword = s.source_name.replace("threads-keyword:", "").trim() || "기타";
    const current = map.get(keyword) || { count: 0, top: [] };
    current.count += 1;
    if (current.top.length < 3) current.top.push(s);
    map.set(keyword, current);
  }

  return [...map.entries()]
    .map(([keyword, v]) => ({ keyword, count: v.count, top: v.top }))
    .sort((a, b) => b.count - a.count);
}

export default async function HomePage() {
  const data = await getHomeData();
  const recos = recommended(data.signals);
  const seriesRecos = seriesRecommended(data.signals);
  const keywordRows = keywordStats(data.signals);
  const activeSources = data.sources.filter((s: { enabled: boolean }) => s.enabled);
  const tomorrowSignals = ((data.tomorrowDraft as { source_json?: Signal[] } | null)?.source_json || []) as Signal[];
  const collected = summarizeCollected(tomorrowSignals);
  const priorityCount = sourcePriorityCounts(tomorrowSignals);

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px", fontFamily: "system-ui, sans-serif" }}>
      <h1>ThreadBot Dashboard (Vercel)</h1>

      <section>
        <h2>1. 최근 실제 게시글 (7일)</h2>
        {data.posts.length === 0 ? <p>최근 게시 내역이 없습니다.</p> : data.posts.map((p) => <article key={p.posted_at}><p><strong>{new Date(p.posted_at).toLocaleString("ko-KR")}</strong></p><pre style={{ whiteSpace: "pre-wrap" }}>{p.post}</pre></article>)}
      </section>

      <section>
        <h2>2. 일주일 내 올려야할 추천 글 5개 (단건)</h2>
        {recos.map((r) => (
          <details key={r.title} style={{ marginBottom: 12 }}>
            <summary>{r.title}</summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{r.post}</pre>
          </details>
        ))}
      </section>

      <section>
        <h2>2-2. 연속 글 구조 추천 (3편)</h2>
        {seriesRecos.map((r) => (
          <details key={r.title} style={{ marginBottom: 12 }}>
            <summary>{r.title}</summary>
            {r.posts.map((p) => (
              <pre key={p.label} style={{ whiteSpace: "pre-wrap", marginBottom: 8 }}>
                {p.post}
              </pre>
            ))}
          </details>
        ))}
      </section>

      <section>
        <h2>3. 태그 리스팅</h2>
        <p>
          <a href="https://www.threads.com/tag/%ED%95%AD%EA%B3%B5%EC%82%AC" target="_blank">#항공사</a> | <a href="https://www.threads.com/tag/%EB%8C%80%ED%95%9C%ED%95%AD%EA%B3%B5" target="_blank">#대한항공</a> | <a href="https://www.threads.com/tag/%EC%95%84%EC%8B%9C%EC%95%84%EB%82%98%ED%95%AD%EA%B3%B5" target="_blank">#아시아나항공</a> | <a href="https://www.threads.com/tag/%EC%8A%B9%EB%AC%B4%EC%9B%90" target="_blank">#승무원</a> | <a href="https://www.threads.com/tag/%EC%8A%B9%EB%AC%B4%EC%9B%90%EC%B1%84%EC%9A%A9" target="_blank">#승무원채용</a> | <a href="https://www.threads.com/tag/%EC%8A%B9%EB%AC%B4%EC%9B%90%EC%B7%A8%EC%97%85" target="_blank">#승무원취업</a>
          </p>
      </section>

      <section>
        <h2>3-2. 키워드별 수집 건수/상위 글</h2>
        {keywordRows.length === 0 ? (
          <p>최근 7일 키워드 수집 데이터가 없습니다.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>키워드</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>수집 건수</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>상위 글</th>
              </tr>
            </thead>
            <tbody>
              {keywordRows.map((row) => (
                <tr key={row.keyword}>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>{row.keyword}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>{row.count}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>
                    {row.top.map((s) => (
                      <div key={`${row.keyword}-${s.link}`}>
                        <a href={s.link} target="_blank">
                          {s.title}
                        </a>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>4. 최근 승무원 채용 정보(진행중)</h2>
        {ongoing(data.signals).map((s) => (
          <article key={`${s.title}-${s.link}`} style={{ marginBottom: 8 }}>
            <a href={s.link} target="_blank">{s.title}</a>
            <div style={{ color: "#555", fontSize: 13 }}>{s.summary}</div>
          </article>
        ))}
      </section>

      <section>
        <h2>수집 URL</h2>
        <SourceManager initial={activeSources} editToken={process.env.EDIT_TOKEN} />
      </section>

      <section>
        <h2>내일 업로드 예정 글 (09:00 KST)</h2>
        {data.tomorrowDraft ? (
          <article>
            <p>
              <strong>{data.tomorrowDraft.draft_date}</strong> / 상태: {data.tomorrowDraft.status}
            </p>
            <pre style={{ whiteSpace: "pre-wrap" }}>{data.tomorrowDraft.post}</pre>
            <Link href={`/edit?date=${data.tomorrowDraft.draft_date}`}>내일 글 수정하기</Link>
          </article>
        ) : (
          <p>내일({data.tomorrow}) 예정 초안이 아직 없습니다. 오늘 23:59(KST) 수집/작성 후 표시됩니다.</p>
        )}
      </section>

      <section>
        <h2>내일 업로드예정글을 위한 수집 내용</h2>
        {tomorrowSignals.length === 0 ? (
          <p>수집 요약이 아직 없습니다.</p>
        ) : (
          <>
            <p>
              오늘 수집 우선순위 적용 결과: threads {priorityCount.threads}건 / naver {priorityCount.naver}건 / 공식 {priorityCount.official}건
            </p>
            <p>총 수집 건수: {collected.total}건</p>
            <p>
              항공사 분포:{" "}
              {collected.airlines.map(([name, count]) => `${name} ${count}건`).join(" / ")}
            </p>
            <ul>
              {collected.topItems.map((s) => (
                <li key={`${s.title}-${s.link}`}>
                  <a href={s.link} target="_blank">
                    {s.title}
                  </a>
                  {" - "}
                  {s.summary}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <h2>글 규칙 (자동생성)</h2>
        <ul>
          <li>하루 1개만 게시 (KST 기준)</li>
          <li>5슬라이드 고정 (1/5~5/5)</li>
          <li>한 문장 한 줄</li>
          <li>짧은 구어체 존댓말</li>
          <li>첫 슬라이드 훅: 질문형/반전형 + 숫자</li>
          <li>전개: 공감 → 문제 → 내 경험 → 해결 → 행동 유도</li>
          <li>슬라이드당 핵심 1개</li>
          <li>이모지 1~2개 이내</li>
          <li>마지막 슬라이드: 요약 1줄 + 부드러운 CTA</li>
          <li>링크는 마지막 슬라이드에 1~2개</li>
        </ul>
      </section>

      <section>
        <h2>최근 초안 수정</h2>
        {data.drafts[0] ? <Link href={`/edit?date=${data.drafts[0].draft_date}`}>최근 초안 열기</Link> : <p>초안 없음</p>}
      </section>
    </main>
  );
}
