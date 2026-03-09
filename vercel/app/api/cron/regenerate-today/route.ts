import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/env";
import { cronUnauthorizedResponse, notFoundResponse, serverErrorResponse } from "@/lib/apiError";
import { supabaseAdmin } from "@/lib/supabase";
import { generatePostDetailed } from "@/lib/generate";
import { getWriteMode } from "@/lib/writeMode";
import type { Signal } from "@/lib/types";
import { safeRecordCronRun } from "@/lib/cronRun";
import { getPostingThemePrompt, isPostMatchingPostingTheme } from "@/lib/postingTheme";
import { kstDate } from "@/lib/kst";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return cronUnauthorizedResponse();

  const db = supabaseAdmin();
  try {
    const today = kstDate();
    let { data: draft } = await db
      .from("drafts")
      .select("id,draft_date,post,source_json")
      .eq("draft_date", today)
      .maybeSingle();

    if (!draft) {
      const fallback = await db
        .from("drafts")
        .select("id,draft_date,post,source_json")
        .lte("draft_date", today)
        .order("draft_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      draft = fallback.data || null;
    }
    if (!draft) return notFoundResponse("재작성할 초안이 없습니다.");

    const writeMode = await getWriteMode(db);
    let signals: Signal[] = ((draft.source_json as Signal[] | null) || []).slice(0, 120);
    if (writeMode === "direct") {
      const since = new Date();
      since.setDate(since.getDate() - 180);
      const { data: manualRows } = await db
        .from("signals")
        .select("source_name,source_url,title,link,published_at,airline,role,summary,confidence,created_at")
        .eq("source_name", "manual-upload")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(1000);
      signals = ((manualRows || []) as Signal[]).slice(0, 120);
    }
    if (signals.length === 0) return notFoundResponse("재작성에 사용할 수집 데이터가 없습니다.");

    const style = process.env.STYLE_SAMPLE || "친근한 승무원 취업 코칭 톤";
    let regen = await generatePostDetailed(
      signals,
      style,
      `${getPostingThemePrompt(draft.draft_date)}\n링크 금지/댓글유도 금지/자기홍보 금지/마지막 ❤️ 규칙을 강하게 적용해 재작성. 시드:${Date.now()}`,
      { temperature: 0.95 },
    );
    for (let i = 0; i < 2; i += 1) {
      if (regen.provider !== "openai") break;
      if (isPostMatchingPostingTheme(draft.draft_date, regen.post)) break;
      regen = await generatePostDetailed(
        signals,
        style,
        `${getPostingThemePrompt(draft.draft_date)}\n주제 불일치로 재작성합니다. 이번 게시 차례의 주제 키워드를 명확히 반영하세요. 시드:${Date.now()}-${i}`,
        { temperature: 1.0 },
      );
    }

    if (regen.provider !== "openai") {
      await safeRecordCronRun(db, {
        cronName: "morning",
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
      cronName: "morning",
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
