"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegenerateDraftButton({ draftDate }: { draftDate: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function regenerate() {
    setLoading(true);
    setMsg("");
    const res = await fetch(`/api/drafts/${draftDate}`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error || "AI 재작성 실패");
      return;
    }
    setMsg(`AI로 내일 글 다시 작성 완료 (${data.updated_at || "updated"})`);
    router.refresh();
    setTimeout(() => {
      if (typeof window !== "undefined") window.location.reload();
    }, 400);
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button onClick={regenerate} disabled={loading}>{loading ? "AI 재작성 중..." : "AI로 내일 글 다시 작성하기"}</button>
      {msg ? <p>{msg}</p> : null}
    </div>
  );
}
