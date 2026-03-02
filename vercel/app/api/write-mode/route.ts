import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { badRequestResponse, serverErrorResponse, unauthorizedResponse } from "@/lib/apiError";
import { supabaseAdmin } from "@/lib/supabase";
import { getWriteMode, setWriteMode, type WriteMode } from "@/lib/writeMode";

export async function GET() {
  try {
    const db = supabaseAdmin();
    const mode = await getWriteMode(db);
    return NextResponse.json({ mode });
  } catch (error) {
    return serverErrorResponse("api/write-mode GET", error);
  }
}

export async function POST(req: Request) {
  if (!isAdminRequest(req)) return unauthorizedResponse();
  try {
    const body = (await req.json()) as { mode?: WriteMode };
    if (body.mode !== "crawl" && body.mode !== "direct") {
      return badRequestResponse("mode 값은 crawl 또는 direct 만 가능합니다.");
    }
    const db = supabaseAdmin();
    const result = await setWriteMode(db, body.mode);
    if (!result.ok) return serverErrorResponse("api/write-mode POST", result.error || "setWriteMode failed");
    return NextResponse.json({ ok: true, mode: body.mode });
  } catch (error) {
    return serverErrorResponse("api/write-mode POST", error);
  }
}
