import { NextResponse } from "next/server";
import { isAuthorizedSecretCron } from "@/lib/env";
import { cronSecretUnauthorizedResponse, notFoundResponse, serverErrorResponse } from "@/lib/apiError";
import { supabaseAdmin } from "@/lib/supabase";
import { composeDraftPost } from "@/lib/draftComposer";
import { loadSignalsForDraft } from "@/lib/draftSignals";
import { getWriteMode } from "@/lib/writeMode";
import { safeRecordCronRun } from "@/lib/cronRun";
import { kstDate } from "@/lib/kst";

export async function GET(req: Request) {
  if (!isAuthorizedSecretCron(req)) return cronSecretUnauthorizedResponse();

  const db = supabaseAdmin();
  try {
    const today = kstDate();
    const { data: draft } = await db
      .from("drafts")
      .select("id,draft_date,post,source_json")
      .eq("draft_date", today)
      .maybeSingle();
    if (!draft) return notFoundResponse("재작성할 초안이 없습니다.");

    const writeMode = await getWriteMode(db);
    const { signals } = await loadSignalsForDraft(db, writeMode, draft.source_json);
    if (signals.length === 0) return notFoundResponse("재작성에 사용할 수집 데이터가 없습니다.");

    const style = process.env.STYLE_SAMPLE || "친근한 승무원 취업 코칭 톤";
    const regen = await composeDraftPost({
      targetDate: draft.draft_date,
      signals,
      styleSample: style,
      oldPost: String(draft.post || ""),
      mode: "regenerate",
      customInstructions: [
        "오늘 초안만 재작성합니다.",
        "기존 초안과 첫 문장, 전개, 결론이 다르게 보이게 다시 씁니다.",
      ],
    });

    if (regen.provider !== "openai") {
      await safeRecordCronRun(db, {
        cronName: "regenerate-today",
        ok: false,
        statusCode: 503,
        summary: "수동 재작성 실패",
        details: { reason: regen.reason || "unknown" },
      });
      return NextResponse.json({ ok: false, error: "AI 재작성 실패", reason: regen.reason }, { status: 503 });
    }

    const { data, error } = await db
      .from("drafts")
      .update({
        post: regen.post,
        source_json: signals,
        approved: false,
        status: "regenerated",
        updated_at: new Date().toISOString(),
      })
      .eq("id", draft.id)
      .select("id,draft_date,status,updated_at")
      .single();
    if (error) return serverErrorResponse("api/cron/regenerate-today update", error);

    await safeRecordCronRun(db, {
      cronName: "regenerate-today",
      ok: true,
      statusCode: 200,
      summary: "수동 재작성 성공",
      details: { draft_date: data.draft_date, writeMode, source_count: signals.length },
    });
    return NextResponse.json({ ok: true, draft: data });
  } catch (error) {
    return serverErrorResponse("api/cron/regenerate-today GET", error);
  }
}
