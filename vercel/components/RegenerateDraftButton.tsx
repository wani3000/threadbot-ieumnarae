"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminAuthHeader } from "@/lib/supabaseBrowser";

export default function RegenerateDraftButton({ draftDate }: { draftDate: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function regenerate() {
    setLoading(true);
    setMsg("");
    const auth = await getAdminAuthHeader();
    const sessionRes = await fetch("/api/admin/session", { headers: auth, cache: "no-store" });
    const session = await sessionRes.json().catch(() => ({}));
    if (!session?.authenticated) {
      setLoading(false);
      setMsg("관리자 로그인 후 다시 시도해주세요.");
      return;
    }

    const res = await fetch(`/api/drafts/${draftDate}`, {
      method: "POST",
      headers: auth,
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error || "AI 재작성 실패");
      return;
    }
    const preview = Array.isArray(data.source_preview)
      ? data.source_preview
          .slice(0, 2)
          .map((v: { title?: string }) => v.title || "")
          .filter(Boolean)
          .join(" / ")
      : "";
    setMsg(
      `AI 재작성 완료 (${data.updated_at || "updated"}) · 모드:${data.write_mode || "-"} · 소스:${data.source_count || 0}건${preview ? ` · 예시:${preview}` : ""}`,
    );
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
