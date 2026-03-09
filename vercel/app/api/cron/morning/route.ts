import { NextResponse } from "next/server";
import { baseUrl, getEnv, isAuthorizedCron } from "@/lib/env";
import { cronUnauthorizedResponse, serverErrorResponse } from "@/lib/apiError";
import { supabaseAdmin } from "@/lib/supabase";
import { collectFromSource, collectFromThreadsKeywords, dedupeSignals, prioritizeSignals } from "@/lib/collect";
import { generatePost } from "@/lib/generate";
import { sendDraftEmail } from "@/lib/email";
import { syncDefaultSources } from "@/lib/sourceSync";
import { isOfficialRecruitSource } from "@/lib/sourceClassify";
import { getWriteMode } from "@/lib/writeMode";
import { safeRecordCronRun } from "@/lib/cronRun";
import { getPostingThemePrompt, isPostMatchingPostingTheme } from "@/lib/postingTheme";
import { isKstWeekend, kstDate, kstWeekday, nextPostingDate } from "@/lib/kst";
import type { Signal, Source } from "@/lib/types";

function influencerSourcePriority(source: Source): number {
  const v = `${source.name} ${source.url}`.toLowerCase();
  if (v.includes("threads.com")) return 0;
  if (v.includes("blog.naver.com")) return 1;
  if (v.includes("instagram.com")) return 2;
  if (v.includes("facebook.com")) return 3;
  return 4;
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return cronUnauthorizedResponse();
  }
  const quick = new URL(req.url).searchParams.get("quick") === "1";

  const db = supabaseAdmin();
  if (isKstWeekend()) {
    await safeRecordCronRun(db, {
      cronName: "morning",
      ok: true,
      statusCode: 200,
      summary: "주말은 글 작성/게시 대상 아님(스킵)",
      details: { today: kstDate(0) },
    });
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "weekend_no_posting",
      today: kstDate(0),
    });
  }
  await syncDefaultSources(db);
  const writeMode = await getWriteMode(db);
  const today = kstDate(0);
  const targetDate = nextPostingDate(1);
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const allSignals: Signal[] = [];
  let keywordSignals: Signal[] = [];
  let includeOfficialToday = false;
  let officialSourcesCount = 0;
  let influencerSourcesCount = 0;

  if (writeMode === "direct") {
    const { data: manualRows } = await db
      .from("signals")
      .select("source_name,source_url,title,link,published_at,airline,role,summary,confidence,created_at")
      .eq("source_name", "manual-upload")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(300);
    allSignals.push(...((manualRows || []) as Signal[]));
  } else {
    const { data: sources, error: sourceErr } = await db
      .from("sources")
      .select("name,url,enabled")
      .eq("enabled", true);
    if (sourceErr) {
      await safeRecordCronRun(db, {
        cronName: "morning",
        ok: false,
        statusCode: 500,
        summary: "소스 조회 실패",
        details: { error: String(sourceErr) },
      });
      return serverErrorResponse("api/cron/morning sources", sourceErr);
    }

    const sourceList = (sources || []) as Source[];
    const officialWeekday = Number(getEnv("OFFICIAL_SOURCE_WEEKDAY", "1")); // 0=Sun, 1=Mon ...
    includeOfficialToday = kstWeekday() === officialWeekday;
    const influencerSources = sourceList
      .filter((s) => !isOfficialRecruitSource(s))
      .sort((a, b) => influencerSourcePriority(a) - influencerSourcePriority(b));
    const officialSources = sourceList.filter((s) => isOfficialRecruitSource(s));
    influencerSourcesCount = influencerSources.length;
    officialSourcesCount = officialSources.length;
    const baseTargets = includeOfficialToday ? [...influencerSources, ...officialSources] : influencerSources;
    const sourceTargets = quick ? baseTargets.slice(0, 12) : baseTargets;
    const settled = await Promise.allSettled(sourceTargets.map((source) => collectFromSource(source, since.toISOString())));
    for (const s of settled) {
      if (s.status === "fulfilled") allSignals.push(...s.value);
    }
    keywordSignals = quick
      ? await collectFromThreadsKeywords(since.toISOString(), { maxQueries: 5, pages: 1, limit: 12, minScore: 3 })
      : await collectFromThreadsKeywords(since.toISOString());
    allSignals.push(...keywordSignals);
  }

  const signals = prioritizeSignals(dedupeSignals(allSignals));

  const shouldPersistCollected = writeMode !== "direct";
  if (signals.length > 0 && shouldPersistCollected) {
    await db.from("signals").insert(
      signals.map((s) => ({
        ...s,
        signal_date: today,
      })),
    );
  }

  const styleSample = getEnv("STYLE_SAMPLE", "친근한 승무원 취업 코칭 톤");
  const { data: latestPostRow } = await db
    .from("posts")
    .select("post,posted_at")
    .order("posted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestPostText = String(latestPostRow?.post || "").trim();
  const latestPostPreview = latestPostText ? latestPostText.split("\n").slice(0, 6).join(" / ") : "";
  const extraPrompt = [
    getPostingThemePrompt(targetDate),
    "다음 게시일 업로드 예정 글은 직전 게시글과 주제와 전개가 겹치면 안 됩니다.",
    "오늘 글의 훅/전개/예시/핵심 메시지를 반복하지 마세요.",
    "직전 게시글과 훅, 사례, 전개 순서가 겹치지 않게 쓰세요.",
    latestPostPreview ? `오늘 게시글 일부: ${latestPostPreview}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let post = await generatePost(signals, styleSample, extraPrompt);
  for (let i = 0; i < 2; i += 1) {
    if (isPostMatchingPostingTheme(targetDate, post)) break;
    post = await generatePost(
      signals,
      styleSample,
      `${extraPrompt}\n현재 결과가 이번 게시 차례의 주제와 맞지 않았습니다. 반드시 해당 주제 키워드를 반영해 다시 작성하세요.`,
    );
  }

  const { data: draftRow, error: draftErr } = await db
    .from("drafts")
    .upsert(
      {
        draft_date: targetDate,
        post,
        source_json: signals,
        status: "pending",
        approved: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "draft_date" },
    )
    .select("id,draft_date")
    .single();

  if (draftErr) {
    await safeRecordCronRun(db, {
      cronName: "morning",
      ok: false,
      statusCode: 500,
      summary: "다음 게시일 초안 저장 실패",
      details: { error: String(draftErr), targetDate },
    });
    return serverErrorResponse("api/cron/morning upsert-draft", draftErr);
  }

  const editUrl = `${baseUrl()}/edit?date=${targetDate}`;
  await sendDraftEmail({
    to: getEnv("EMAIL_TO"),
    from: getEnv("EMAIL_FROM"),
    subject: `[ThreadBot] ${targetDate} 09:00 자동게시 예정 초안`,
    post,
    editUrl,
  });

  await safeRecordCronRun(db, {
    cronName: "morning",
    ok: true,
    statusCode: 200,
    summary: "수집/초안 생성 성공",
    details: {
      quick,
      writeMode,
      targetDate,
      signals: signals.length,
      sourceSignals: allSignals.length - keywordSignals.length,
      keywordSignals: keywordSignals.length,
      includeOfficialToday,
    },
  });

  return NextResponse.json({
    ok: true,
    quick,
    writeMode,
    draft: draftRow,
    signals: signals.length,
    sourceSignals: allSignals.length - keywordSignals.length,
    keywordSignals: keywordSignals.length,
    includeOfficialToday,
    officialSources: officialSourcesCount,
    influencerSources: influencerSourcesCount,
    targetDate,
    editUrl,
  });
}
