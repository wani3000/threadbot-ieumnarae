import { getEnv } from "./env";
import { getAppSettingText, setAppSettingText } from "./appSettings";

const GRAPH_BASE = (process.env.THREADS_GRAPH_BASE || "https://graph.threads.net").replace(/\/$/, "");
const TOKEN_URL = "manual://config/threads_publish_token";
const EXPIRES_URL = "manual://config/threads_publish_token_expires_at";
const TOKEN_KEY = "threads_publish_token";
const EXPIRES_KEY = "threads_publish_token_expires_at";

export async function getThreadsPublishToken(db: any): Promise<string> {
  try {
    const stored = await getAppSettingText(db, TOKEN_KEY, { legacyUrl: TOKEN_URL });
    const value = (stored || "").trim();
    if (value) return value;
  } catch (error) {
    console.error("[getThreadsPublishToken]", error);
  }
  return getEnv("THREADS_PUBLISH_TOKEN", "");
}

export async function getThreadsTokenExpiresAt(db: any): Promise<string | null> {
  try {
    const stored = await getAppSettingText(db, EXPIRES_KEY, { legacyUrl: EXPIRES_URL });
    const value = (stored || "").trim();
    if (value) return value;
  } catch (error) {
    console.error("[getThreadsTokenExpiresAt]", error);
    return null;
  }
  return null;
}

export async function setThreadsPublishToken(db: any, token: string, expiresInSec?: number) {
  const expiresAt = new Date(Date.now() + Math.max(0, Number(expiresInSec || 0)) * 1000).toISOString();
  await setAppSettingText(db, TOKEN_KEY, token, { legacyUrl: TOKEN_URL, legacyEnabled: false });
  await setAppSettingText(db, EXPIRES_KEY, expiresAt, { legacyUrl: EXPIRES_URL, legacyEnabled: false });
}

export async function refreshThreadsLongLivedToken(currentToken: string): Promise<{
  ok: boolean;
  accessToken?: string;
  expiresIn?: number;
  status: number;
  body: unknown;
}> {
  const params = new URLSearchParams({
    grant_type: "th_refresh_token",
    access_token: currentToken,
  });
  const res = await fetch(`${GRAPH_BASE}/refresh_access_token?${params.toString()}`, {
    method: "GET",
  });
  const json = await res.json().catch(async () => ({ raw: await res.text() }));
  const accessToken = (json as { access_token?: string })?.access_token;
  const expiresIn = Number((json as { expires_in?: number })?.expires_in || 0);
  return {
    ok: res.ok && Boolean(accessToken),
    accessToken,
    expiresIn,
    status: res.status,
    body: json,
  };
}

export function isThreadsTokenError(result: { body: unknown }): boolean {
  const obj = result.body as
    | { step?: string; response?: { error?: { code?: number; message?: string } } }
    | undefined;
  const code = Number(obj?.response?.error?.code || 0);
  const msg = String(obj?.response?.error?.message || "").toLowerCase();
  return code === 190 || msg.includes("access token");
}

export async function checkThreadsTokenHealth(db: any): Promise<{
  active: boolean;
  status: number;
  message: string;
}> {
  const token = await getThreadsPublishToken(db);
  if (!token) {
    return { active: false, status: 0, message: "THREADS_PUBLISH_TOKEN 없음" };
  }

  const url = `${GRAPH_BASE}/me?fields=id,username`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    const json = await res.json().catch(async () => ({ raw: await res.text() }));
    if (res.ok) {
      return { active: true, status: res.status, message: "정상" };
    }
    const msg = ((json as any)?.error?.message || "토큰 검증 실패") as string;
    return { active: false, status: res.status, message: msg };
  } catch (error) {
    console.error("[checkThreadsTokenHealth]", error);
    return { active: false, status: 0, message: "토큰 검증 중 네트워크 오류" };
  }
}
