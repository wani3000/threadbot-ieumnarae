import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import type { Signal } from "@/lib/types";
import SourceManager from "@/components/SourceManager";

export const dynamic = "force-dynamic";

async function getHomeData() {
  const db = supabaseAdmin();
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const weekAgoIso = weekAgo.toISOString();

  const [{ data: posts }, { data: drafts }, { data: signals }, { data: sources }] = await Promise.all([
    db.from("posts").select("posted_at,post").gte("posted_at", weekAgoIso).order("posted_at", { ascending: false }).limit(10),
    db.from("drafts").select("draft_date,post,status,approved,updated_at").order("draft_date", { ascending: false }).limit(5),
    db.from("signals").select("title,link,summary,published_at,airline,role,confidence").gte("created_at", weekAgoIso).order("published_at", { ascending: false }).limit(50),
    db.from("sources").select("name,url,enabled").order("created_at", { ascending: true }),
  ]);

  return {
    posts: posts || [],
    drafts: drafts || [],
    signals: (signals || []) as Signal[],
    sources: sources || [],
  };
}

function recommended(signals: Signal[]) {
  return signals.slice(0, 5).map((s) => ({
    title: s.title,
    post: `[이번 주 취업 체크]\n${s.title}\n\n핵심: ${s.summary}\n원문: ${s.link}`,
  }));
}

function ongoing(signals: Signal[]) {
  return signals.filter((s) => /채용|모집|승무원|객실|recruit|hiring/i.test(`${s.title} ${s.summary}`)).slice(0, 20);
}

export default async function HomePage() {
  const data = await getHomeData();
  const recos = recommended(data.signals);
  const activeSources = data.sources.filter((s: { enabled: boolean }) => s.enabled);

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px", fontFamily: "system-ui, sans-serif" }}>
      <h1>ThreadBot Dashboard (Vercel)</h1>

      <section>
        <h2>1. 최근 실제 게시글 (7일)</h2>
        {data.posts.length === 0 ? <p>최근 게시 내역이 없습니다.</p> : data.posts.map((p) => <article key={p.posted_at}><p><strong>{new Date(p.posted_at).toLocaleString("ko-KR")}</strong></p><pre style={{ whiteSpace: "pre-wrap" }}>{p.post}</pre></article>)}
      </section>

      <section>
        <h2>2. 일주일 내 올려야할 추천 글 5개</h2>
        {recos.map((r) => (
          <details key={r.title} style={{ marginBottom: 12 }}>
            <summary>{r.title}</summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{r.post}</pre>
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
        <h2>오늘 초안 수정</h2>
        {data.drafts[0] ? <Link href={`/edit?date=${data.drafts[0].draft_date}`}>최근 초안 열기</Link> : <p>초안 없음</p>}
      </section>
    </main>
  );
}
