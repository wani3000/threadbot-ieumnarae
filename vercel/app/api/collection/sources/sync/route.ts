import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { serverErrorResponse, unauthorizedResponse } from "@/lib/apiError";
import { supabaseAdmin } from "@/lib/supabase";
import { syncDefaultSources } from "@/lib/sourceSync";

export async function POST(req: Request) {
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) return unauthorizedResponse();
  try {
    const db = supabaseAdmin();
    const result = await syncDefaultSources(db);
    if (result.error) return serverErrorResponse("api/collection/sources/sync POST", result.error);

    const { data, error } = await db
      .from("sources")
      .select("id,name,url,enabled")
      .order("created_at", { ascending: true });

    if (error) return serverErrorResponse("api/collection/sources/sync POST", error);
    return NextResponse.json({ synced: true, added: result.added, items: data || [] });
  } catch (error) {
    return serverErrorResponse("api/collection/sources/sync POST", error);
  }
}
