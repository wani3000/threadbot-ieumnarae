"use client";

import { useEffect, useState } from "react";

export default function WriteModeSelector() {
  const [mode, setMode] = useState<"crawl" | "direct">("crawl");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/write-mode", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { mode: "crawl" }))
      .then((d) => setMode((d.mode || "crawl") as "crawl" | "direct"))
      .catch(() => {});
  }, []);

  async function update(next: "crawl" | "direct") {
    setMsg("");
    const res = await fetch("/api/write-mode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: next }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "변경 실패");
      return;
    }
    setMode(next);
    setMsg(`작성모드 변경 완료: ${next === "crawl" ? "크롤링 정보" : "직접올린글"}`);
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <p>현재 작성모드: <strong>{mode === "crawl" ? "크롤링 정보로 글쓰기" : "직접올린글로 글쓰기"}</strong></p>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => update("crawl")} disabled={mode === "crawl"}>크롤링 정보로 글쓰기</button>
        <button onClick={() => update("direct")} disabled={mode === "direct"}>직접올린글로 글쓰기</button>
      </div>
      {msg ? <p>{msg}</p> : null}
    </div>
  );
}
