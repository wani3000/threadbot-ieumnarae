import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { badRequestResponse, serverErrorResponse, unauthorizedResponse } from "@/lib/apiError";
import { supabaseAdmin } from "@/lib/supabase";

function kstDate(): string {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })).toISOString().slice(0, 10);
}

function splitChunks(raw: string): string[] {
  return raw
    .split(/\n\s*\n+/)
    .map((v) => v.trim())
    .filter((v) => v.length >= 20);
}

function titleFrom(text: string): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > 70 ? `${one.slice(0, 70)}...` : one;
}

export async function GET(req: Request) {
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) return unauthorizedResponse();
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("signals")
      .select("created_at,title,summary,link")
      .eq("source_name", "manual-upload")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return serverErrorResponse("api/manual/ingest GET", error);
    return NextResponse.json(data || []);
  } catch (error) {
    return serverErrorResponse("api/manual/ingest GET", error);
  }
}

export async function POST(req: Request) {
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) return unauthorizedResponse();
  try {
    const body = (await req.json()) as { text?: string };
    const text = (body.text || "").trim();
    if (text.length < 20) return badRequestResponse("본문이 너무 짧습니다.");

    const chunks = splitChunks(text).slice(0, 200);
    if (chunks.length === 0) return badRequestResponse("저장 가능한 문단이 없습니다.");

    const now = new Date();
    const base = now.getTime();
    const rows = chunks.map((chunk, idx) => ({
      signal_date: kstDate(),
      source_name: "manual-upload",
      source_url: "manual://dashboard-upload",
      title: `직접입력: ${titleFrom(chunk)}`,
      link: `manual://entry/${base}-${idx + 1}`,
      published_at: now.toISOString(),
      airline: null,
      role: /승무원|cabin|flight attendant/i.test(chunk) ? "승무원" : null,
      summary: chunk,
      confidence: "high" as const,
    }));

    const db = supabaseAdmin();
    const { error } = await db.from("signals").insert(rows);
    if (error) return serverErrorResponse("api/manual/ingest POST", error);

    return NextResponse.json({ ok: true, saved: rows.length });
  } catch (error) {
    return serverErrorResponse("api/manual/ingest POST", error);
  }
}
