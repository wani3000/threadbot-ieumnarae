"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import RegenerateDraftButton from "@/components/RegenerateDraftButton";
import { getAdminAuthHeader } from "@/lib/supabaseBrowser";

type Draft = {
  draft_date: string;
  post: string;
  status: string;
  approved: boolean;
  updated_at?: string;
};

export default function TomorrowDraftPanel({ draftDate }: { draftDate: string }) {
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    const auth = await getAdminAuthHeader();
    const res = await fetch(`/api/drafts/${draftDate}`, { headers: auth, cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setDraft(null);
      setMsg(data.error || "다음 게시일 초안을 불러오지 못했습니다.");
      return;
    }
    setDraft(data as Draft);
  }, [draftDate]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p>다음 게시일 초안 불러오는 중...</p>;

  if (!draft) {
    return (
      <div>
        <p>다음 게시일({draftDate}) 예정 초안이 아직 없습니다. 다음 수집 실행 후 표시됩니다.</p>
        {msg ? <p>{msg}</p> : null}
      </div>
    );
  }

  return (
    <article>
      <p>
        <strong>{draft.draft_date}</strong> / 상태: {draft.status}
        {draft.updated_at ? ` / 수정시각: ${new Date(draft.updated_at).toLocaleString("ko-KR")}` : ""}
      </p>
      <pre style={{ whiteSpace: "pre-wrap" }}>{draft.post}</pre>
      <p style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Link href={`/edit?date=${draft.draft_date}`}>다음 게시일 글 수정하기</Link>
        <button onClick={load}>새로고침</button>
      </p>
      <RegenerateDraftButton draftDate={draft.draft_date} onDone={load} />
      {msg ? <p>{msg}</p> : null}
    </article>
  );
}
