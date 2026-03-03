import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/env";
import { cronUnauthorizedResponse, serverErrorResponse } from "@/lib/apiError";
import { supabaseAdmin } from "@/lib/supabase";
import { getThreadsPublishToken, getThreadsTokenExpiresAt, refreshThreadsLongLivedToken, setThreadsPublishToken } from "@/lib/threadsToken";
import { safeRecordCronRun } from "@/lib/cronRun";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return cronUnauthorizedResponse();

  const db = supabaseAdmin();
  try {
    const current = await getThreadsPublishToken(db);
    if (!current) {
      await safeRecordCronRun(db, {
        cronName: "token-refresh",
        ok: false,
        statusCode: 400,
        summary: "토큰 없음",
      });
      return NextResponse.json({ ok: false, error: "THREADS_PUBLISH_TOKEN이 없습니다." }, { status: 400 });
    }

    const beforeExpiresAt = await getThreadsTokenExpiresAt(db);
    const refreshed = await refreshThreadsLongLivedToken(current);
    if (!refreshed.ok || !refreshed.accessToken) {
      await safeRecordCronRun(db, {
        cronName: "token-refresh",
        ok: false,
        statusCode: 502,
        summary: "토큰 갱신 실패",
        details: {
          status: refreshed.status,
          result: refreshed.body,
          before_expires_at: beforeExpiresAt,
        },
      });
      return NextResponse.json(
        {
          ok: false,
          refreshed: false,
          status: refreshed.status,
          result: refreshed.body,
          before_expires_at: beforeExpiresAt,
        },
        { status: 502 },
      );
    }

    await setThreadsPublishToken(db, refreshed.accessToken, refreshed.expiresIn);
    const afterExpiresAt = await getThreadsTokenExpiresAt(db);
    await safeRecordCronRun(db, {
      cronName: "token-refresh",
      ok: true,
      statusCode: 200,
      summary: "토큰 갱신 성공",
      details: {
        before_expires_at: beforeExpiresAt,
        after_expires_at: afterExpiresAt,
        expires_in: refreshed.expiresIn || null,
      },
    });

    return NextResponse.json({
      ok: true,
      refreshed: true,
      before_expires_at: beforeExpiresAt,
      after_expires_at: afterExpiresAt,
      expires_in: refreshed.expiresIn || null,
    });
  } catch (error) {
    await safeRecordCronRun(db, {
      cronName: "token-refresh",
      ok: false,
      statusCode: 500,
      summary: "토큰 갱신 예외",
      details: { error: String(error) },
    });
    return serverErrorResponse("api/cron/token-refresh GET", error);
  }
}
