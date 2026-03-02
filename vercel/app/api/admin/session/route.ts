import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminPasswordMatches, isAdminRequest, issueAdminSession } from "@/lib/adminAuth";
import { badRequestResponse, serverErrorResponse } from "@/lib/apiError";

const COOKIE_MAX_AGE = 60 * 60 * 12; // 12h

export async function GET(req: Request) {
  return NextResponse.json({ authenticated: isAdminRequest(req) });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { password?: string };
    const password = (body.password || "").trim();
    if (!password) return badRequestResponse("비밀번호를 입력해주세요.");
    if (!adminPasswordMatches(password)) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const session = issueAdminSession(12);
    const res = NextResponse.json({ ok: true, authenticated: true });
    res.cookies.set({
      name: ADMIN_COOKIE,
      value: session,
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
    return res;
  } catch (error) {
    return serverErrorResponse("api/admin/session POST", error);
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true, authenticated: false });
  res.cookies.set({
    name: ADMIN_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    expires: new Date(0),
    path: "/",
  });
  return res;
}
