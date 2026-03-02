import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { badRequestResponse, notFoundResponse, serverErrorResponse, unauthorizedResponse } from "@/lib/apiError";
import { supabaseAdmin } from "@/lib/supabase";
import { generatePostDetailed } from "@/lib/generate";
import { getWriteMode } from "@/lib/writeMode";
import type { Signal } from "@/lib/types";

export async function GET(req: Request, { params }: { params: { draftDate: string } }) {
  if (!isAdminRequest(req)) return unauthorizedResponse();
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
  if (!isAdminRequest(req)) return unauthorizedResponse();
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
  if (!isAdminRequest(req)) return unauthorizedResponse();

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

    if (writeMode === "direct") {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const { data: manualRows } = await db
        .from("signals")
        .select("source_name,source_url,title,link,published_at,airline,role,summary,confidence,created_at")
        .eq("source_name", "manual-upload")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(300);
      signals = ((manualRows || []) as Signal[]).slice(0, 120);
    } else {
      signals = ((draft.source_json as Signal[] | null) || []).slice(0, 120);
    }

    if (signals.length === 0) {
      signals = ((draft.source_json as Signal[] | null) || []).slice(0, 120);
    }

    const style = process.env.STYLE_SAMPLE || "친근한 승무원 취업 코칭 톤";
    let result = await generatePostDetailed(signals, style, "기존 초안과 다른 훅/전개로 재작성");
    if (result.provider !== "openai") {
      console.error("[api/drafts POST] regenerate fallback reason:", result.reason);
      return NextResponse.json(
        { error: "AI 재작성에 실패했습니다. OpenAI 키/크레딧 상태를 확인해주세요." },
        { status: 503 },
      );
    }

    let regenerated = result.post;
    const oldPost = String(draft.post || "").trim();
    if (regenerated.trim() === oldPost) {
      result = await generatePostDetailed(
        signals,
        style,
        `기존 글과 반드시 다르게 작성. 새로운 훅 사용. 요청시각:${new Date().toISOString()}`,
      );
      if (result.provider === "openai") regenerated = result.post;
    }

    if (regenerated.trim() === oldPost) {
      return NextResponse.json(
        { error: "재작성 결과가 기존 글과 동일합니다. 수집 소스 추가 후 다시 시도해주세요." },
        { status: 409 },
      );
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
    });
  } catch (error) {
    return serverErrorResponse("api/drafts POST", error);
  }
}
