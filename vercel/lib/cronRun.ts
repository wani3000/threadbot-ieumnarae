import type { SupabaseClient } from "@supabase/supabase-js";

type CronRunInput = {
  cronName: "morning" | "post" | "token-refresh" | "regenerate-today" | "telegram-preview";
  ok: boolean;
  statusCode?: number;
  summary: string;
  details?: Record<string, unknown> | null;
};

export async function safeRecordCronRun(db: SupabaseClient, input: CronRunInput): Promise<void> {
  try {
    await db.from("cron_runs").insert({
      cron_name: input.cronName,
      ok: input.ok,
      status_code: input.statusCode ?? null,
      summary: input.summary,
      details: input.details ?? null,
    });
  } catch {
    // Logging should never break cron flow.
  }
}
