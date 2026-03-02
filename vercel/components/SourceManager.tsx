"use client";

import { useEffect, useState } from "react";
import { isOfficialRecruitSource } from "@/lib/sourceClassify";
import { getAdminAuthHeader } from "@/lib/supabaseBrowser";

type Source = { id?: string; name: string; url: string; enabled: boolean };
const isExternalUrl = (u: string) => /^https?:\/\//i.test(u);

export default function SourceManager({ initial }: { initial: Source[] }) {
  const [sources, setSources] = useState(initial);
  const [name, setName] = useState("");
  const [urlText, setUrlText] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/collection/sources", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!alive) return;
        if (Array.isArray(data)) setSources(data as Source[]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function addSource() {
    setMsg("");
    const auth = await getAdminAuthHeader();
    const urls = urlText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await fetch("/api/collection/sources", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...auth,
      },
      body: JSON.stringify({ name, urls }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "추가 실패");
      return;
    }
    const added = (data.items || []) as Source[];
    setSources((prev) => [...prev, ...added]);
    setName("");
    setUrlText("");
    setMsg(`추가 완료 (${data.added || 0}개)`);
  }

  async function syncDefaults() {
    setMsg("");
    const auth = await getAdminAuthHeader();
    const res = await fetch("/api/collection/sources/sync", {
      method: "POST",
      headers: {
        ...auth,
      },
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "동기화 실패");
      return;
    }
    setSources((data.items || []) as Source[]);
    setMsg(`기본 URL 동기화 완료 (신규 ${data.added || 0}개)`);
  }

  return (
    <div>
      <p>총 {sources.filter((s) => s.enabled && isExternalUrl(s.url)).length}개</p>
      <h3>1. 공식 항공사 채용 홈페이지</h3>
      <ul>
        {sources
          .filter((s) => s.enabled && isExternalUrl(s.url) && isOfficialRecruitSource(s))
          .map((s) => (
            <li key={s.id || `${s.name}-${s.url}`}>{s.name}: {s.url}</li>
          ))}
      </ul>
      <h3>2. 승무원 관련 강사/인플루언서</h3>
      <ul>
        {sources
          .filter((s) => s.enabled && isExternalUrl(s.url) && !isOfficialRecruitSource(s))
          .map((s) => (
            <li key={s.id || `${s.name}-${s.url}`}>{s.name}: {s.url}</li>
          ))}
      </ul>
      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        <button onClick={syncDefaults}>기본 수집 URL 자동 동기화</button>
        <input placeholder="소스 이름 (선택: 1개 입력 시만 적용)" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea
          placeholder={"https://example.com/1\nhttps://example.com/2"}
          value={urlText}
          onChange={(e) => setUrlText(e.target.value)}
          rows={5}
        />
        <button onClick={addSource}>URL 직접 추가하기</button>
        {msg ? <p>{msg}</p> : null}
      </div>
    </div>
  );
}
