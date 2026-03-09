import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { badRequestResponse, notFoundResponse, serverErrorResponse, unauthorizedResponse } from "@/lib/apiError";
import { supabaseAdmin } from "@/lib/supabase";
import { generatePostDetailed } from "@/lib/generate";
import { getWriteMode } from "@/lib/writeMode";
import type { Signal } from "@/lib/types";
import { getPostingThemePrompt, isPostMatchingPostingTheme } from "@/lib/postingTheme";

function normalizePost(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function forceDifferentHook(post: string, oldPost: string): string {
  const hooks = [
    "면접 준비, 순서가 중요해요.",
    "오늘은 합격 루틴만 짚어볼게요.",
    "이거 놓치면 준비가 느려져요.",
    "직접올린글 기반으로 핵심만 정리할게요.",
  ];
  const oldFirst = oldPost.split("\n").find((l) => l.trim()) || "";
  const pick = hooks.find((h) => h !== oldFirst) || `${hooks[0]} ${Date.now()}`;

  const lines = post.split("\n");
  const idx = lines.findIndex((l) => l.trim().length > 0);
  if (idx >= 0) lines[idx] = pick;
  return lines.join("\n");
}

export async function GET(req: Request, { params }: { params: { draftDate: string } }) {
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) return unauthorizedResponse();
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("drafts")
      .select("draft_date,post,status,approved,updated_at,source_json")
      .eq("draft_date", params.draftDate)
      .single();
    if (error) return notFoundResponse();
    return NextResponse.json(data);
  } catch (error) {
    return serverErrorResponse("api/drafts GET", error);
  }
}

export async function PATCH(req: Request, { params }: { params: { draftDate: string } }) {
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) return unauthorizedResponse();
  try {
    const body = (await req.json()) as { post?: string; approved?: boolean };
    if (!body.post || body.post.trim().length < 10) {
      return badRequestResponse("게시글이 너무 짧습니다.");
    }

    const db = supabaseAdmin();
    const { data, error } = await db
      .from("drafts")
      .update({
        post: body.post,
        approved: Boolean(body.approved),
        status: body.approved ? "approved" : "edited",
        updated_at: new Date().toISOString(),
      })
      .eq("draft_date", params.draftDate)
      .select("draft_date,post,status,approved,updated_at")
      .single();

    if (error) return serverErrorResponse("api/drafts PATCH", error);
    return NextResponse.json(data);
  } catch (error) {
    return serverErrorResponse("api/drafts PATCH", error);
  }
}

export async function POST(req: Request, { params }: { params: { draftDate: string } }) {
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) return unauthorizedResponse();

  try {
    const db = supabaseAdmin();
    const { data: draft, error: readErr } = await db
      .from("drafts")
      .select("draft_date,source_json,post")
      .eq("draft_date", params.draftDate)
      .single();
    if (readErr || !draft) return notFoundResponse("초안을 찾을 수 없습니다.");

    const writeMode = await getWriteMode(db);
    let signals: Signal[] = [];
    let sourceType: "manual-upload" | "crawl-signals" = "crawl-signals";

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
      sourceType = "manual-upload";
      if (signals.length === 0) {
        return badRequestResponse("직접올린글 모드인데 저장된 직접올린글이 없습니다. 정보올리기에서 먼저 저장해주세요.");
      }
    } else {
      signals = ((draft.source_json as Signal[] | null) || []).slice(0, 120);
      if (signals.length === 0) {
        return badRequestResponse("크롤링 소스 데이터가 없습니다. 수집을 먼저 실행해주세요.");
      }
    }

    const style = process.env.STYLE_SAMPLE || "친근한 승무원 취업 코칭 톤";
    const regenNonce = `${new Date().toISOString()}-${Math.random().toString(36).slice(2, 8)}`;
    let result = await generatePostDetailed(
      signals,
      style,
      `${getPostingThemePrompt(params.draftDate)}\n기존 초안과 다른 훅/전개로 재작성. 링크 금지, 댓글유도 금지, 자기홍보 금지. 고유 시드:${regenNonce}`,
      { temperature: 0.9 },
    );
    if (result.provider !== "openai") {
      console.error("[api/drafts POST] regenerate fallback reason:", result.reason);
      return NextResponse.json(
        { error: "AI 재작성에 실패했습니다. OpenAI 키/크레딧 상태를 확인해주세요." },
        { status: 503 },
      );
    }

    let regenerated = result.post;
    const oldPost = String(draft.post || "").trim();
    if (normalizePost(regenerated) === normalizePost(oldPost)) {
      result = await generatePostDetailed(
        signals,
        style,
        `${getPostingThemePrompt(params.draftDate)}\n기존 글과 반드시 다르게 작성. 새로운 훅 사용. 이전본문첫줄:${oldPost.split("\n")[0] || "-"} 고유시드:${Date.now()}`,
        { temperature: 1.0 },
      );
      if (result.provider === "openai") regenerated = result.post;
    }

    for (let i = 0; i < 2; i += 1) {
      if (isPostMatchingPostingTheme(params.draftDate, regenerated)) break;
      result = await generatePostDetailed(
        signals,
        style,
        `${getPostingThemePrompt(params.draftDate)}\n현재 결과가 이번 게시 차례의 주제와 맞지 않습니다. 해당 주제 키워드를 더 분명하게 반영해 다시 작성하세요. 시드:${Date.now()}-${i}`,
        { temperature: 1.0 },
      );
      if (result.provider === "openai") regenerated = result.post;
    }

    if (normalizePost(regenerated) === normalizePost(oldPost)) {
      regenerated = forceDifferentHook(regenerated, oldPost);
    }

    const { data, error } = await db
      .from("drafts")
      .update({
        post: regenerated,
        source_json: signals,
        approved: false,
        status: "regenerated",
        updated_at: new Date().toISOString(),
      })
      .eq("draft_date", params.draftDate)
      .select("draft_date,post,status,approved,updated_at")
      .single();

    if (error) return serverErrorResponse("api/drafts POST", error);
    return NextResponse.json({
      ...data,
      changed: true,
      source_count: signals.length,
      write_mode: writeMode,
      source_type: sourceType,
      source_preview: signals.slice(0, 5).map((s) => ({
        title: s.title,
        source_name: s.source_name,
      })),
    });
  } catch (error) {
    return serverErrorResponse("api/drafts POST", error);
  }
}
