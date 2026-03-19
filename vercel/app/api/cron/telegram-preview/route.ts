import { NextResponse } from "next/server";
import { baseUrl, getEnv, isAuthorizedCron } from "@/lib/env";
import { cronUnauthorizedResponse, notFoundResponse, serverErrorResponse } from "@/lib/apiError";
import { safeRecordCronRun } from "@/lib/cronRun";
import { isKstWeekend, scheduledPostingDate } from "@/lib/kst";
import { supabaseAdmin } from "@/lib/supabase";
import { sendDraftTelegramPreview } from "@/lib/telegram";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return cronUnauthorizedResponse();
  }

  const db = supabaseAdmin();
  if (isKstWeekend()) {
    await safeRecordCronRun(db, {
      cronName: "telegram-preview",
      ok: true,
      statusCode: 200,
      summary: "주말은 텔레그램 미리보기 대상 아님(스킵)",
      details: { targetDate: scheduledPostingDate() },
    });
    return NextResponse.json({ ok: true, skipped: true, reason: "weekend_no_posting" });
  }

  const token = getEnv("TELEGRAM_BOT_TOKEN");
  const chatId = getEnv("TELEGRAM_CHAT_ID");
  if (!token || !chatId) {
    await safeRecordCronRun(db, {
      cronName: "telegram-preview",
      ok: false,
      statusCode: 500,
      summary: "텔레그램 환경변수 누락",
      details: { hasToken: Boolean(token), hasChatId: Boolean(chatId) },
    });
    return NextResponse.json({ error: "텔레그램 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const targetDate = new URL(req.url).searchParams.get("date") || scheduledPostingDate();
  const { data: draft, error } = await db
    .from("drafts")
    .select("draft_date,post,status")
    .eq("draft_date", targetDate)
    .maybeSingle();

  if (error) {
    await safeRecordCronRun(db, {
      cronName: "telegram-preview",
      ok: false,
      statusCode: 500,
      summary: "텔레그램 미리보기 초안 조회 실패",
      details: { targetDate, error: String(error) },
    });
    return serverErrorResponse("api/cron/telegram-preview draft-read", error);
  }

  if (!draft?.post) {
    await safeRecordCronRun(db, {
      cronName: "telegram-preview",
      ok: false,
      statusCode: 404,
      summary: "텔레그램 미리보기 대상 초안 없음",
      details: { targetDate },
    });
    return notFoundResponse("텔레그램으로 보낼 초안이 없습니다.");
  }

  const editUrl = `${baseUrl()}/edit?date=${targetDate}`;

  try {
    const sent = await sendDraftTelegramPreview({
      token,
      chatId,
      targetDate,
      post: draft.post,
      editUrl,
    });

    await safeRecordCronRun(db, {
      cronName: "telegram-preview",
      ok: true,
      statusCode: 200,
      summary: "텔레그램 초안 미리보기 전송 성공",
      details: { targetDate, status: draft.status, messages: sent.count },
    });

    return NextResponse.json({ ok: true, targetDate, messages: sent.count });
  } catch (sendError) {
    await safeRecordCronRun(db, {
      cronName: "telegram-preview",
      ok: false,
      statusCode: 502,
      summary: "텔레그램 전송 실패",
      details: { targetDate, error: String(sendError) },
    });
    return serverErrorResponse("api/cron/telegram-preview send", sendError, "텔레그램 전송 중 오류가 발생했습니다.");
  }
}
