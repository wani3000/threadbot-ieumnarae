"use client";

import { useEffect, useState } from "react";

export default function ManualIngestForm({ editToken }: { editToken?: string }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState<Array<{ created_at: string; title: string; summary: string }>>([]);

  async function loadRecent() {
    const res = await fetch("/api/manual/ingest", {
      headers: { "x-edit-token": editToken || "" },
      cache: "no-store",
    });
    const data = await res.json().catch(() => []);
    if (res.ok && Array.isArray(data)) {
      setRecent(data);
    }
  }

  useEffect(() => {
    loadRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/manual/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-edit-token": editToken || "",
      },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMsg(data.error || "저장 실패");
      return;
    }
    setMsg(`저장 완료: ${data.saved || 0}건`);
    setText("");
    await loadRecent();
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <textarea
        rows={18}
        placeholder={"여러 글을 그냥 붙여넣으세요.\n문단(빈 줄) 단위로 자동 분리 저장됩니다."}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button onClick={save} disabled={saving}>{saving ? "저장 중..." : "저장하기"}</button>
      {msg ? <p>{msg}</p> : null}
      <h3>최근 저장된 직접올린글</h3>
      {recent.length === 0 ? (
        <p>아직 없습니다.</p>
      ) : (
        <ul>
          {recent.map((r) => (
            <li key={`${r.created_at}-${r.title}`} style={{ marginBottom: 12 }}>
              <strong>{new Date(r.created_at).toLocaleString("ko-KR")}</strong>
              <div>{r.title}</div>
              <div style={{ color: "#555" }}>
                {r.summary.slice(0, 180)}
                {r.summary.length > 180 ? "..." : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
