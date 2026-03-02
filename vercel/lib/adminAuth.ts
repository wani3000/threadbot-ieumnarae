import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env";

type AdminAuthResult = {
  ok: boolean;
  email?: string;
};

function extractBearer(req: Request): string {
  const raw = req.headers.get("authorization") || "";
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || "";
}

function allowedEmails(): string[] {
  const raw = getEnv("ADMIN_EMAILS", getEnv("EMAIL_TO", ""));
  return raw
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

export async function verifyAdminRequest(req: Request): Promise<AdminAuthResult> {
  const token = extractBearer(req);
  if (!token) return { ok: false };

  try {
    const supabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user?.email) return { ok: false };
    const email = data.user.email.toLowerCase();
    const allow = allowedEmails();
    if (allow.length > 0 && !allow.includes(email)) return { ok: false, email };
    return { ok: true, email };
  } catch (error) {
    console.error("[verifyAdminRequest]", error);
    return { ok: false };
  }
}
