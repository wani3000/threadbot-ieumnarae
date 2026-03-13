import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { badRequestResponse, notFoundResponse, serverErrorResponse, unauthorizedResponse } from "@/lib/apiError";
import { supabaseAdmin } from "@/lib/supabase";
import { composeDraftPost } from "@/lib/draftComposer";
import { loadSignalsForDraft } from "@/lib/draftSignals";
import { getWriteMode } from "@/lib/writeMode";
import { scheduledPostingDate } from "@/lib/kst";

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
    const targetDate = params.draftDate;
    if (targetDate !== scheduledPostingDate()) {
      return badRequestResponse("다음 게시일 초안만 AI 재작성할 수 있습니다.");
    }
    const { data: draft, error: readErr } = await db
      .from("drafts")
      .select("draft_date,source_json,post")
      .eq("draft_date", params.draftDate)
      .single();
    if (readErr || !draft) return notFoundResponse("초안을 찾을 수 없습니다.");

    const writeMode = await getWriteMode(db);
    const { signals, sourceType } = await loadSignalsForDraft(db, writeMode, draft.source_json);
    if (signals.length === 0) {
      return badRequestResponse(
        writeMode === "direct"
          ? "직접올린글 모드인데 저장된 직접올린글이 없습니다. 정보올리기에서 먼저 저장해주세요."
          : "크롤링 소스 데이터가 없습니다. 수집을 먼저 실행해주세요.",
      );
    }

    const style = process.env.STYLE_SAMPLE || "친근한 승무원 취업 코칭 톤";
    const oldPost = String(draft.post || "").trim();
    const result = await composeDraftPost({
      targetDate: params.draftDate,
      signals,
      styleSample: style,
      oldPost,
      mode: "regenerate",
      customInstructions: [
        "기존 초안과 다른 훅과 사례로 재작성합니다.",
        "직접올린글 모드라면 저장된 원문 표현을 바탕으로 재구성하되 그대로 복붙하지 않습니다.",
      ],
    });
    if (result.provider !== "openai") {
      console.error("[api/drafts POST] regenerate fallback reason:", result.reason);
      return NextResponse.json(
        { error: "AI 재작성에 실패했습니다. OpenAI 키/크레딧 상태를 확인해주세요." },
        { status: 503 },
      );
    }

    const regenerated = result.post;

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
