"use client";

import { useEffect, useState } from "react";
import { getAdminAuthHeader, getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type SessionState = {
  loading: boolean;
  authenticated: boolean;
  email: string | null;
  message: string;
};

export default function AdminSessionPanel() {
  const [state, setState] = useState<SessionState>({
    loading: true,
    authenticated: false,
    email: null,
    message: "",
  });

  async function checkSession() {
    try {
      const headers = await getAdminAuthHeader();
      const res = await fetch("/api/admin/session", { headers, cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setState({
        loading: false,
        authenticated: Boolean(data?.authenticated),
        email: data?.email || null,
        message: "",
      });
    } catch (error) {
      console.error("[AdminSessionPanel.checkSession]", error);
      setState({
        loading: false,
        authenticated: false,
        email: null,
        message: "Google 로그인 설정을 확인해주세요.",
      });
    }
  }

  useEffect(() => {
    checkSession();
  }, []);

  async function loginWithGoogle() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setState((prev) => ({ ...prev, message: "Supabase 공개키 설정이 필요합니다." }));
      return;
    }
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setState((prev) => ({ ...prev, message: "Google 로그인 시작 실패" }));
    }
  }

  async function logout() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setState((prev) => ({ ...prev, message: "Supabase 공개키 설정이 필요합니다." }));
      return;
    }
    await supabase.auth.signOut();
    setState({
      loading: false,
      authenticated: false,
      email: null,
      message: "로그아웃 완료",
    });
  }

  if (state.loading) return <p>관리자 세션 확인 중...</p>;

  return (
    <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
      <p>
        관리자 세션: <strong>{state.authenticated ? "로그인됨" : "로그인 필요"}</strong>
        {state.email ? ` (${state.email})` : ""}
      </p>
      {!state.authenticated ? (
        <button onClick={loginWithGoogle} style={{ width: 180 }}>
          Google로 로그인
        </button>
      ) : (
        <button onClick={logout} style={{ width: 120 }}>
          로그아웃
        </button>
      )}
      {state.message ? <p>{state.message}</p> : null}
    </div>
  );
}
