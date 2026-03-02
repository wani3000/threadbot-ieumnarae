"use client";

import { useEffect, useState } from "react";

export default function AdminSessionPanel() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  async function loadSession() {
    setLoading(true);
    const res = await fetch("/api/admin/session", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    setAuthenticated(Boolean(data?.authenticated));
    setLoading(false);
  }

  useEffect(() => {
    loadSession().catch(() => setLoading(false));
  }, []);

  async function login() {
    setMsg("");
    const res = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error || "로그인 실패");
      return;
    }
    setPassword("");
    setAuthenticated(true);
    setMsg("로그인 완료");
  }

  async function logout() {
    setMsg("");
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthenticated(false);
    setMsg("로그아웃 완료");
  }

  if (loading) return <p>관리자 세션 확인 중...</p>;

  return (
    <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
      <p>
        관리자 세션: <strong>{authenticated ? "로그인됨" : "로그인 필요"}</strong>
      </p>
      {!authenticated ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="password"
            placeholder="관리자 비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={login}>로그인</button>
        </div>
      ) : (
        <button onClick={logout} style={{ width: 120 }}>
          로그아웃
        </button>
      )}
      {msg ? <p>{msg}</p> : null}
    </div>
  );
}
