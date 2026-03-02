"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

type Draft = {
  draft_date: string;
  post: string;
  status: string;
  approved: boolean;
  updated_at?: string;
};

function EditInner() {
  const search = useSearchParams();
  const date = search.get("date") || "";
  const token = search.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");

  const endpoint = useMemo(() => (date ? `/api/drafts/${date}?token=${encodeURIComponent(token)}` : ""), [date, token]);

  useEffect(() => {
    if (!endpoint) return;
    (async () => {
      setLoading(true);
      const res = await fetch(endpoint, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setDraft(data);
        setText(data.post || "");
      } else {
        setMessage(data.error || "초안을 불러오지 못했습니다.");
      }
      setLoading(false);
    })();
  }, [endpoint]);

  async function save(approved: boolean) {
    if (!date) return;
    const res = await fetch(`/api/drafts/${date}?token=${encodeURIComponent(token)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post: text, approved }),
    });
    const data = await res.json();
    if (res.ok) {
      setDraft(data);
      setMessage(approved ? "승인 완료: 09:00 자동게시 본문으로 사용됩니다." : "수정 저장 완료");
    } else {
      setMessage(data.error || "저장 실패");
    }
  }

  if (!date) return <main style={{ padding: 24 }}>date 파라미터가 필요합니다.</main>;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>초안 수정</h1>
      <p>날짜: {date}</p>
      {loading ? <p>로딩 중...</p> : null}
      {message ? <p>{message}</p> : null}
      {draft ? <p>상태: {draft.status} / 승인: {String(draft.approved)}</p> : null}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={18} style={{ width: "100%", padding: 12 }} />
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button onClick={() => save(false)}>수정 저장</button>
        <button onClick={() => save(true)}>승인 완료</button>
      </div>
    </main>
  );
}

export default function EditPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>로딩 중...</main>}>
      <EditInner />
    </Suspense>
  );
}
