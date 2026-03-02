import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/lib/apiError";
import { verifyAdminRequest } from "@/lib/adminAuth";

export async function GET(req: Request) {
  try {
    const result = await verifyAdminRequest(req);
    return NextResponse.json({ authenticated: result.ok, email: result.email || null });
  } catch (error) {
    return serverErrorResponse("api/admin/session GET", error);
  }
}

export async function POST(req: Request) {
  return GET(req);
}
