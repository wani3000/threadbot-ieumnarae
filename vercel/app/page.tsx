import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import type { Signal } from "@/lib/types";
import SourceManager from "@/components/SourceManager";
import WriteModeSelector from "@/components/WriteModeSelector";
import AdminSessionPanel from "@/components/AdminSessionPanel";
import TomorrowDraftPanel from "@/components/TomorrowDraftPanel";
import { isOfficialRecruitSource } from "@/lib/sourceClassify";
import { FULL_CONTENT_GUIDE, RULE_CHECKLIST } from "@/lib/contentGuide";
import { checkThreadsTokenHealth, getThreadsTokenExpiresAt } from "@/lib/threadsToken";
import { getPostingTheme, getPostingThemeRotationStartDate, getPostingThemeTable } from "@/lib/postingTheme";
import { kstDate, scheduledPostingDate } from "@/lib/kst";

export const dynamic = "force-dynamic";

function kstStartIso(dateKst: string): string {
  return new Date(`${dateKst}T00:00:00+09:00`).toISOString();
}

async function getHomeData() {
  const db = supabaseAdmin();
  const today = kstDate(0);
  const tomorrow = scheduledPostingDate();
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const weekAgoIso = weekAgo.toISOString();

  const [
    { data: posts },
    { data: drafts },
    { data: signals },
    { data: sources },
    { data: tomorrowDraft },
    { data: cronRuns },
    { data: todayDraft },
    { data: todayPosts },
  ] = await Promise.all([
    db.from("posts").select("draft_id,posted_at,post,publish_result").gte("posted_at", weekAgoIso).order("posted_at", { ascending: false }).limit(20),
    db.from("drafts").select("draft_date,post,status,approved,updated_at").order("draft_date", { ascending: false }).limit(5),
    db.from("signals").select("source_name,title,link,summary,published_at,airline,role,confidence").gte("created_at", weekAgoIso).order("published_at", { ascending: false }).limit(200),
    db.from("sources").select("name,url,enabled").order("created_at", { ascending: true }),
    db.from("drafts").select("draft_date,post,status,approved,updated_at,source_json").eq("draft_date", tomorrow).maybeSingle(),
    db.from("cron_runs").select("cron_name,run_at,ok,status_code,summary,details").order("run_at", { ascending: false }).limit(30),
    db.from("drafts").select("id,draft_date,status,updated_at").eq("draft_date", today).maybeSingle(),
    db.from("posts").select("draft_id,posted_at,publish_result").gte("posted_at", kstStartIso(today)).order("posted_at", { ascending: false }).limit(5),
  ]);

  let appSettingsReady = false;
  try {
    const { error } = await db.from("app_settings").select("key").limit(1);
    appSettingsReady = !error;
  } catch {
    appSettingsReady = false;
  }

  const successfulTodayPost = (todayPosts || []).find((row: { publish_result?: { ok?: boolean } | null }) => row.publish_result?.ok === true) || null;

  return {
    today,
    tomorrow,
    posts: (posts || []).filter((row: { publish_result?: { ok?: boolean } | null }) => row.publish_result?.ok === true),
    drafts: drafts || [],
    signals: (signals || []) as Signal[],
    sources: sources || [],
    tomorrowDraft: tomorrowDraft || null,
    todayDraft: todayDraft || null,
    successfulTodayPost,
    cronRuns: cronRuns || [],
    appSettingsReady,
    tokenExpiresAt: await getThreadsTokenExpiresAt(db),
    tokenHealth: await checkThreadsTokenHealth(db),
  };
}

function latestCronByName(
  runs: Array<{ cron_name: string; run_at: string; ok: boolean; status_code: number | null; summary: string; details?: Record<string, unknown> | null }>,
  cronName: string,
) {
  return runs.find((r) => r.cron_name === cronName) || null;
}

function cronDetailMessage(details: Record<string, unknown> | null | undefined): string {
  if (!details) return "-";
  const error = details.error;
  if (typeof error === "string" && error.trim()) return error;
  const result = details.result;
  if (result && typeof result === "object") {
    const msg = (result as { error?: { message?: string }; message?: string })?.error?.message || (result as { message?: string }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return "-";
}

function tokenRemainDays(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const t = new Date(expiresAt).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = t - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

function recommended(signals: Signal[]) {
  return signals.slice(0, 5).map((s) => ({
    title: s.title,
    post: `주제: ${s.title}\n\n핵심: ${s.summary}\n\n이 포인트를 어떻게 글로 풀지 미리 점검합니다.`,
  }));
}

function seriesRecommended(signals: Signal[]) {
  const top = signals.slice(0, 4);
  if (top.length === 0) return [];
  return [
    {
      title: "연속 글 구조 추천 (문단형)",
      posts: top.map((s, idx) => ({
        label: `${idx + 1}편`,
        post: `주제: ${s.title}\n핵심: ${s.summary}`,
      })),
    },
  ];
}

function ongoingOfficialCabin(signals: Signal[], todayKstIso: string) {
  return signals
    .filter((s) => isOfficialRecruitSource({ name: s.source_name || "", url: s.source_url || "" }))
    .filter((s) => /승무원|객실|cabin|flight attendant/i.test(`${s.title} ${s.summary} ${s.role || ""}`))
    .filter((s) => !s.published_at || s.published_at >= todayKstIso)
    .slice(0, 30);
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

function summarizePublishResult(result: unknown): string {
  if (!result || typeof result !== "object") return "-";
  const body = (result as { body?: { step?: string; count?: number; ids?: string[] } }).body;
  if (!body) return "-";
  const ids = Array.isArray(body.ids) ? body.ids.length : 0;
  const count = typeof body.count === "number" ? body.count : ids;
  if (count > 0) return `${count}개 세그먼트 게시`;
  if (body.step) return body.step;
  return "-";
}

export default async function HomePage() {
  const data = await getHomeData();
  const todayKstIso = kstStartIso(kstDate(0));
  const recos = recommended(data.signals);
  const seriesRecos = seriesRecommended(data.signals);
  const ongoingCabinRows = ongoingOfficialCabin(data.signals, todayKstIso);
  const keywordRows = keywordStats(data.signals);
  const activeSources = data.sources.filter((s: { enabled: boolean; url: string }) => s.enabled && /^https?:\/\//i.test(s.url));
  const tomorrowSignals = ((data.tomorrowDraft as { source_json?: Signal[] } | null)?.source_json || []) as Signal[];
  const collected = summarizeCollected(tomorrowSignals);
  const priorityCount = sourcePriorityCounts(tomorrowSignals);
  const remainDays = tokenRemainDays(data.tokenExpiresAt);
  const tomorrowTheme = getPostingTheme(data.tomorrow);
  const postingThemeTable = getPostingThemeTable();
  const lastMorning = latestCronByName(
    data.cronRuns as Array<{ cron_name: string; run_at: string; ok: boolean; status_code: number | null; summary: string; details?: Record<string, unknown> | null }>,
    "morning",
  );
  const lastPost = latestCronByName(
    data.cronRuns as Array<{ cron_name: string; run_at: string; ok: boolean; status_code: number | null; summary: string; details?: Record<string, unknown> | null }>,
    "post",
  );
  const lastTokenRefresh = latestCronByName(
    data.cronRuns as Array<{ cron_name: string; run_at: string; ok: boolean; status_code: number | null; summary: string; details?: Record<string, unknown> | null }>,
    "token-refresh",
  );

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px", fontFamily: "system-ui, sans-serif" }}>
      <h1>ieumnarae-threadbot Dashboard (Vercel)</h1>

      <section>
        <h2>마지막 Cron 실행 결과</h2>
        {data.cronRuns.length === 0 ? (
          <p>아직 cron 실행 로그가 없습니다. (DB에 cron_runs 테이블 생성 후 표시)</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {[
              { label: "초안 생성 (23:59)", row: lastMorning },
              { label: "자동 게시 (09:00)", row: lastPost },
              { label: "토큰 갱신 (00:10)", row: lastTokenRefresh },
            ].map((item) => (
              <article key={item.label} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
                <p style={{ margin: 0 }}>
                  <strong>{item.label}</strong>
                </p>
                {!item.row ? (
                  <p style={{ margin: "8px 0 0" }}>실행 이력 없음</p>
                ) : (
                  <>
                    <p style={{ margin: "8px 0 0" }}>
                      상태:{" "}
                      <strong style={{ color: item.row.ok ? "#0a7f2e" : "#b42318" }}>{item.row.ok ? "성공" : "실패"}</strong>
                      {" / "}시각: {new Date(item.row.run_at).toLocaleString("ko-KR")}
                      {" / "}코드: {item.row.status_code ?? "-"}
                    </p>
                    <p style={{ margin: "4px 0 0" }}>요약: {item.row.summary}</p>
                    <p style={{ margin: "4px 0 0" }}>실패사유: {item.row.ok ? "-" : cronDetailMessage(item.row.details)}</p>
                  </>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>오늘 게시 추적</h2>
        <p>오늘 KST 기준 날짜: {data.today}</p>
        <p>
          오늘 초안 상태:{" "}
          <strong>{(data.todayDraft as { status?: string } | null)?.status || "없음"}</strong>
          {data.todayDraft ? ` / 수정시각: ${new Date((data.todayDraft as { updated_at?: string }).updated_at || "").toLocaleString("ko-KR")}` : ""}
        </p>
        <p>
          오늘 게시 성공 여부:{" "}
          <strong style={{ color: data.successfulTodayPost ? "#0a7f2e" : "#b42318" }}>
            {data.successfulTodayPost ? "성공 기록 있음" : "성공 기록 없음"}
          </strong>
        </p>
        {data.successfulTodayPost ? (
          <>
            <p>게시시각: {new Date((data.successfulTodayPost as { posted_at: string }).posted_at).toLocaleString("ko-KR")}</p>
            <p>게시 결과: {summarizePublishResult((data.successfulTodayPost as { publish_result?: unknown }).publish_result)}</p>
            <p>게시된 draft_id: {(data.successfulTodayPost as { draft_id?: string | null }).draft_id || "-"}</p>
          </>
        ) : null}
        <p>
          설정 저장소 상태:{" "}
          <strong>{data.appSettingsReady ? "app_settings 사용 가능" : "레거시 fallback(sources 특수 row) 사용 중 가능성"}</strong>
        </p>
      </section>

      <section>
        <h2>Threads 토큰 상태</h2>
        {data.tokenExpiresAt ? (
          <p>
            만료일: {new Date(data.tokenExpiresAt).toLocaleString("ko-KR")} / 남은 기간:{" "}
            <strong>{remainDays ?? "-"}</strong>일
          </p>
        ) : (
          <p>만료 정보 없음 (토큰 자동갱신 API가 1회 이상 성공하면 표시됩니다).</p>
        )}
        <p>
          활성 상태:{" "}
          <strong style={{ color: data.tokenHealth.active ? "#0a7f2e" : "#b42318" }}>
            {data.tokenHealth.active ? "정상" : "비정상"}
          </strong>
          {" / "}
          코드: {data.tokenHealth.status || "-"}
          {" / "}
          상세: {data.tokenHealth.message}
        </p>
      </section>

      <section>
        <h2>관리자 로그인</h2>
        <AdminSessionPanel />
      </section>

      <section>
        <h2>작성 방식 선택</h2>
        <WriteModeSelector />
        <p style={{ marginTop: 8 }}>
          <Link href="/upload">정보올리기 페이지로 이동</Link>
        </p>
      </section>

      <section>
        <h2>평일 게시 시 7개 주제 순환</h2>
        <p>
          다음 게시일({data.tomorrow}) 예정 주제: <strong>{tomorrowTheme.order}번 / {tomorrowTheme.category}</strong>
        </p>
        <p>순환 시작 기준일: {getPostingThemeRotationStartDate()} / 토·일은 순환에서 제외됩니다.</p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>순번</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>주제</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>예시</th>
            </tr>
          </thead>
          <tbody>
            {postingThemeTable.map((row) => (
              <tr key={row.order}>
                <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>{row.order}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>{row.category}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>
                  <div>{row.example}</div>
                  <details style={{ marginTop: 6 }}>
                    <summary>예시 전체보기</summary>
                    <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{row.fullExample}</pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

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
        <h2>2-2. 연속 글 구조 추천</h2>
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
        {ongoingCabinRows.length === 0 ? (
          <p>오늘 이후 갱신된 공식 캐빈/승무원 채용 공고가 없습니다.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>일자</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>항공사</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>직군</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>공고</th>
              </tr>
            </thead>
            <tbody>
              {ongoingCabinRows.map((s) => (
                <tr key={`${s.title}-${s.link}`}>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>
                    {s.published_at ? new Date(s.published_at).toLocaleString("ko-KR") : "-"}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>{s.airline || "-"}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>{s.role || "객실/승무원 관련"}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>
                    <a href={s.link} target="_blank">{s.title}</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>수집 URL</h2>
        <SourceManager initial={activeSources} />
      </section>

      <section>
        <h2>다음 게시일 업로드 예정 글 (09:00 KST)</h2>
        <TomorrowDraftPanel draftDate={data.tomorrow} />
      </section>

      <section>
        <h2>다음 게시일 글 작성을 위한 수집 내용</h2>
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
          {RULE_CHECKLIST.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <details style={{ marginTop: 12 }}>
          <summary>전체 글 스타일 & 콘텐츠 가이드 보기</summary>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{FULL_CONTENT_GUIDE}</pre>
        </details>
      </section>

      <section>
        <h2>최근 초안 수정</h2>
        {data.drafts[0] ? <Link href={`/edit?date=${data.drafts[0].draft_date}`}>최근 초안 열기</Link> : <p>초안 없음</p>}
      </section>
    </main>
  );
}
