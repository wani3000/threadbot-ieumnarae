import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/env";
import { cronUnauthorizedResponse, notFoundResponse, serverErrorResponse } from "@/lib/apiError";
import { supabaseAdmin } from "@/lib/supabase";
import { publishThreads } from "@/lib/threads";
import { getThreadsPublishToken, isThreadsTokenError, refreshThreadsLongLivedToken, setThreadsPublishToken } from "@/lib/threadsToken";
import { safeRecordCronRun } from "@/lib/cronRun";
import { isKstWeekend, kstDate } from "@/lib/kst";

function kstDayBoundsUtc(dateKst: string): { startUtc: string; endUtc: string } {
  // KST 00:00 is UTC-9h previous day, so we build explicit UTC bounds.
  const start = new Date(`${dateKst}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

const PUBLISHABLE_STATUSES = ["pending", "regenerated", "approved", "edited", "failed"] as const;
const STALE_PUBLISHING_MINUTES = Number(process.env.STALE_PUBLISHING_MINUTES || "90");

function isStalePublishing(updatedAt?: string | null): boolean {
  if (!updatedAt) return false;
  const updated = new Date(updatedAt).getTime();
  if (!Number.isFinite(updated)) return false;
  return Date.now() - updated >= STALE_PUBLISHING_MINUTES * 60 * 1000;
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return cronUnauthorizedResponse();
  }
  const force = new URL(req.url).searchParams.get("force") === "1";

  const db = supabaseAdmin();
  if (isKstWeekend()) {
    await safeRecordCronRun(db, {
      cronName: "post",
      ok: true,
      statusCode: 200,
      summary: "주말은 글 게시 대상 아님(스킵)",
      details: { draft_date: kstDate() },
    });
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "weekend_no_posting",
      draft_date: kstDate(),
    });
  }
  const today = kstDate();
  const { startUtc, endUtc } = kstDayBoundsUtc(today);

  const { data: draft, error } = await db
    .from("drafts")
    .select("id,post,draft_date,status,updated_at")
    .eq("draft_date", today)
    .maybeSingle();
  if (error) {
    await safeRecordCronRun(db, {
      cronName: "post",
      ok: false,
      statusCode: 500,
      summary: "오늘 초안 조회 실패",
      details: { draft_date: today, error: String(error) },
    });
    return serverErrorResponse("api/cron/post draft-read", error);
  }
  if (!draft) {
    await safeRecordCronRun(db, {
      cronName: "post",
      ok: false,
      statusCode: 404,
      summary: "오늘 날짜 초안 없음",
      details: { draft_date: today },
    });
    return notFoundResponse("오늘 게시할 초안이 없습니다.");
  }

  // Hard guard: never publish more than once per KST day.
  const { data: todayPosts, error: postCheckErr } = await db
    .from("posts")
    .select("id,posted_at,publish_result")
    .gte("posted_at", startUtc)
    .lt("posted_at", endUtc)
    .limit(20);
  if (postCheckErr) {
    await safeRecordCronRun(db, {
      cronName: "post",
      ok: false,
      statusCode: 500,
      summary: "중복 게시 점검 실패",
      details: { error: String(postCheckErr) },
    });
    return serverErrorResponse("api/cron/post post-check", postCheckErr);
  }
  const hasSuccessfulPostToday = (todayPosts || []).some((p) => {
    const ok = (p as { publish_result?: { ok?: boolean } | null }).publish_result?.ok;
    return ok === true;
  });
  if (!force && (hasSuccessfulPostToday || draft.status === "posted")) {
    await safeRecordCronRun(db, {
      cronName: "post",
      ok: true,
      statusCode: 200,
      summary: "오늘 이미 게시됨(스킵)",
      details: { draft_date: today, force },
    });
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "already_posted_today",
      draft_date: today,
    });
  }

  const stalePublishing = draft.status === "publishing" && isStalePublishing(draft.updated_at);
  if (!force && draft.status === "publishing" && !stalePublishing) {
    await safeRecordCronRun(db, {
      cronName: "post",
      ok: true,
      statusCode: 200,
      summary: "이미 게시 진행 중(스킵)",
      details: { draft_date: today },
    });
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "already_publishing",
      draft_date: today,
    });
  }

  const lockStatuses = force
    ? [...PUBLISHABLE_STATUSES, "posted", "publishing"]
    : stalePublishing
      ? [...PUBLISHABLE_STATUSES, "publishing"]
      : [...PUBLISHABLE_STATUSES];
  const { data: lockedDraft, error: lockErr } = await db
    .from("drafts")
    .update({
      status: "publishing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", draft.id)
    .in("status", lockStatuses)
    .select("id,post,draft_date,status")
    .maybeSingle();
  if (lockErr) {
    await safeRecordCronRun(db, {
      cronName: "post",
      ok: false,
      statusCode: 500,
      summary: "게시 잠금 실패",
      details: { draft_date: today, error: String(lockErr) },
    });
    return serverErrorResponse("api/cron/post lock", lockErr);
  }
  if (!lockedDraft) {
    await safeRecordCronRun(db, {
      cronName: "post",
      ok: true,
      statusCode: 200,
      summary: "다른 실행이 이미 처리 중(스킵)",
      details: { draft_date: today, status: draft.status },
    });
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "already_processed_elsewhere",
      draft_date: today,
    });
  }

  const token = await getThreadsPublishToken(db);
  let publish = await publishThreads(lockedDraft.post, token);

  if (!publish.ok && isThreadsTokenError(publish)) {
    const refreshed = await refreshThreadsLongLivedToken(token);
    if (refreshed.ok && refreshed.accessToken) {
      await setThreadsPublishToken(db, refreshed.accessToken, refreshed.expiresIn);
      publish = await publishThreads(lockedDraft.post, refreshed.accessToken);
    }
  }

  await db.from("posts").insert({
    draft_id: lockedDraft.id,
    post: lockedDraft.post,
    publish_result: publish,
  });

  await db
    .from("drafts")
    .update({ status: publish.ok ? "posted" : "failed", updated_at: new Date().toISOString() })
    .eq("id", lockedDraft.id);
  await safeRecordCronRun(db, {
    cronName: "post",
    ok: publish.ok,
    statusCode: publish.status,
    summary: publish.ok ? "게시 성공" : "게시 실패",
    details: {
      draft_id: lockedDraft.id,
      draft_date: lockedDraft.draft_date,
      force,
      result: publish.body,
    },
  });

  return NextResponse.json({ ok: publish.ok, status: publish.status, result: publish.body });
}
