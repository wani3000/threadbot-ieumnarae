import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { badRequestResponse, serverErrorResponse, unauthorizedResponse } from "@/lib/apiError";
import { supabaseAdmin } from "@/lib/supabase";

function toSourceName(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.replace(/^\/+|\/+$/g, "").replace(/\//g, "-");
    return path ? `${host}-${path}` : host;
  } catch {
    return rawUrl;
  }
}

export async function GET() {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db.from("sources").select("id,name,url,enabled").order("created_at", { ascending: true });
    if (error) return serverErrorResponse("api/collection/sources GET", error);
    return NextResponse.json(data);
  } catch (error) {
    return serverErrorResponse("api/collection/sources GET", error);
  }
}

export async function POST(req: Request) {
  if (!isAdminRequest(req)) return unauthorizedResponse();
  try {
    const body = (await req.json()) as { name?: string; url?: string; urls?: string[] };
    const rawUrls = body.urls?.length ? body.urls : body.url ? [body.url] : [];
    const urls = Array.from(new Set(rawUrls.map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u))));
    if (urls.length === 0) return badRequestResponse("유효한 URL이 없습니다.");

    const db = supabaseAdmin();
    const rows = urls.map((url) => ({
      name: urls.length === 1 && body.name?.trim() ? body.name.trim() : toSourceName(url),
      url,
      enabled: true,
    }));

    const { data, error } = await db
      .from("sources")
      .upsert(rows, { onConflict: "url", ignoreDuplicates: true })
      .select("id,name,url,enabled");
    if (error) return serverErrorResponse("api/collection/sources POST", error);
    return NextResponse.json({ added: data?.length || 0, items: data || [] });
  } catch (error) {
    return serverErrorResponse("api/collection/sources POST", error);
  }
}
