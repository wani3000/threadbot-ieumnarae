const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "THREADS_PUBLISH_TOKEN",
  "RESEND_API_KEY",
  "EMAIL_TO",
  "EMAIL_FROM",
] as const;

export type RequiredEnv = (typeof required)[number];

export function getEnv(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export function assertEnv(): void {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }
}

function expectedHost(): string | null {
  try {
    return new URL(baseUrl()).host.toLowerCase();
  } catch {
    return null;
  }
}

function hasTrustedVercelCronHeaders(req: Request): boolean {
  const cronHeader = req.headers.get("x-vercel-cron");
  if (!cronHeader) return false;

  const vercelId = req.headers.get("x-vercel-id") || "";
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  const forwardedHost = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase();
  const host = expectedHost();

  const hostMatches = !host || !forwardedHost || forwardedHost === host;
  const looksLikeVercel = ua.includes("vercel");

  return Boolean(vercelId) && hostMatches && looksLikeVercel;
}

function hasBearerCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

export function isAuthorizedScheduledCron(req: Request): boolean {
  if (hasBearerCronSecret(req)) return true;
  return hasTrustedVercelCronHeaders(req);
}

export function isAuthorizedSecretCron(req: Request): boolean {
  return hasBearerCronSecret(req);
}

export function isAuthorizedCron(req: Request): boolean {
  return isAuthorizedScheduledCron(req);
}

export function baseUrl(): string {
  return getEnv("APP_BASE_URL", "http://localhost:3000").replace(/\/$/, "");
}
