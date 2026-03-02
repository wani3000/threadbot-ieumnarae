import { createHmac, timingSafeEqual } from "crypto";
import { getEnv } from "./env";

export const ADMIN_COOKIE = "tb_admin_session";

type SessionPayload = {
  exp: number;
};

function secret(): string {
  return getEnv("ADMIN_SESSION_SECRET", getEnv("EDIT_TOKEN", ""));
}

function sign(payload: SessionPayload): string {
  const body = JSON.stringify(payload);
  const sig = createHmac("sha256", secret()).update(body).digest("hex");
  return `${Buffer.from(body).toString("base64url")}.${sig}`;
}

function verify(token: string): boolean {
  if (!token || !secret()) return false;
  const [bodyB64, sig] = token.split(".");
  if (!bodyB64 || !sig) return false;

  let body = "";
  try {
    body = Buffer.from(bodyB64, "base64url").toString("utf8");
  } catch {
    return false;
  }

  const expected = createHmac("sha256", secret()).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  try {
    const payload = JSON.parse(body) as SessionPayload;
    return Number(payload.exp) > Date.now();
  } catch {
    return false;
  }
}

function readCookie(req: Request, name: string): string {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
}

function readLegacyToken(req: Request): string {
  const u = new URL(req.url);
  return u.searchParams.get("token") || req.headers.get("x-edit-token") || "";
}

export function isAdminRequest(req: Request): boolean {
  const cookieToken = readCookie(req, ADMIN_COOKIE);
  if (verify(cookieToken)) return true;
  const legacy = readLegacyToken(req);
  return Boolean(legacy) && legacy === getEnv("EDIT_TOKEN");
}

export function issueAdminSession(hours = 12): string {
  const exp = Date.now() + hours * 60 * 60 * 1000;
  return sign({ exp });
}

export function adminPasswordMatches(input: string): boolean {
  const configured = getEnv("ADMIN_PASSWORD", getEnv("EDIT_TOKEN", ""));
  return Boolean(configured) && input === configured;
}
