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

export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const hasVercelCronHeader = req.headers.has("x-vercel-cron");
  const userAgent = (req.headers.get("user-agent") || "").toLowerCase();
  const isVercelCronUa = userAgent.includes("vercel-cron") || userAgent.includes("vercel");
  const isManagedCronCall = hasVercelCronHeader || isVercelCronUa;
  if (!secret) {
    return isManagedCronCall;
  }
  const auth = req.headers.get("authorization") || "";
  if (auth === `Bearer ${secret}`) return true;
  // Fallback for Vercel-managed cron invocations in case Authorization header is not attached.
  return isManagedCronCall;
}

export function baseUrl(): string {
  return getEnv("APP_BASE_URL", "http://localhost:3000").replace(/\/$/, "");
}
