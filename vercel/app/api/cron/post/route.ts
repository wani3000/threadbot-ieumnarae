import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/env";
import { cronUnauthorizedResponse, notFoundResponse, serverErrorResponse } from "@/lib/apiError";
import { supabaseAdmin } from "@/lib/supabase";
import { publishThreads } from "@/lib/threads";
import { getThreadsPublishToken, isThreadsTokenError, refreshThreadsLongLivedToken, setThreadsPublishToken } from "@/lib/threadsToken";
import { safeRecordCronRun } from "@/lib/cronRun";

function kstDate(): string {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })).toISOString().slice(0, 10);
}

function kstDayBoundsUtc(dateKst: string): { startUtc: string; endUtc: string } {
  // KST 00:00 is UTC-9h previous day, so we build explicit UTC bounds.
  const start = new Date(`${dateKst}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return cronUnauthorizedResponse();
  }

  const db = supabaseAdmin();
  const today = kstDate();
  const { startUtc, endUtc } = kstDayBoundsUtc(today);

  let { data: draft, error } = await db.from("drafts").select("id,post,draft_date,status").eq("draft_date", today).single();
  if (error || !draft) {
    // Self-heal: if today's draft is missing, try the latest pending/regenerated draft not newer than today.
    const fallback = await db
      .from("drafts")
      .select("id,post,draft_date,status")
      .lte("draft_date", today)
      .in("status", ["pending", "regenerated"])
      .order("draft_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    draft = fallback.data || null;
  }
  if (!draft) {
    await safeRecordCronRun(db, {
      cronName: "post",
      ok: false,
      statusCode: 404,
      summary: "게시 가능한 초안 없음",
      details: { draft_date: today },
    });
    return notFoundResponse("게시 가능한 초안이 없습니다.");
  }

  // Hard guard: never publish more than once per KST day.
  const { data: todayPosts, error: postCheckErr } = await db
    .from("posts")
    .select("id,posted_at")
    .gte("posted_at", startUtc)
    .lt("posted_at", endUtc)
    .limit(1);
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
  if ((todayPosts || []).length > 0 || draft.status === "posted") {
    await safeRecordCronRun(db, {
      cronName: "post",
      ok: true,
      statusCode: 200,
      summary: "오늘 이미 게시됨(스킵)",
      details: { draft_date: today },
    });
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "already_posted_today",
      draft_date: today,
    });
  }

  const token = await getThreadsPublishToken(db);
  let publish = await publishThreads(draft.post, token);

  if (!publish.ok && isThreadsTokenError(publish)) {
    const refreshed = await refreshThreadsLongLivedToken(token);
    if (refreshed.ok && refreshed.accessToken) {
      await setThreadsPublishToken(db, refreshed.accessToken, refreshed.expiresIn);
      publish = await publishThreads(draft.post, refreshed.accessToken);
    }
  }

  await db.from("posts").insert({
    draft_id: draft.id,
    post: draft.post,
    publish_result: publish,
  });

  await db.from("drafts").update({ status: publish.ok ? "posted" : "failed", updated_at: new Date().toISOString() }).eq("id", draft.id);
  await safeRecordCronRun(db, {
    cronName: "post",
    ok: publish.ok,
    statusCode: publish.status,
    summary: publish.ok ? "게시 성공" : "게시 실패",
    details: {
      draft_id: draft.id,
      draft_date: draft.draft_date,
      result: publish.body,
    },
  });

  return NextResponse.json({ ok: publish.ok, status: publish.status, result: publish.body });
}
