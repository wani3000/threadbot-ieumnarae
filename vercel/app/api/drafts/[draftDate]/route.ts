import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { badRequestResponse, notFoundResponse, serverErrorResponse, unauthorizedResponse } from "@/lib/apiError";
import { supabaseAdmin } from "@/lib/supabase";
import { generatePost } from "@/lib/generate";
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
      .select("draft_date,source_json")
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

    const regenerated = await generatePost(signals, process.env.STYLE_SAMPLE || "친근한 승무원 취업 코칭 톤");

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
    return NextResponse.json(data);
  } catch (error) {
    return serverErrorResponse("api/drafts POST", error);
  }
}
