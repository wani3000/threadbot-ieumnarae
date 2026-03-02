import { NextResponse } from "next/server";

export function unauthorizedResponse() {
  return NextResponse.json({ error: "권한이 없습니다. 로그인 후 다시 시도해주세요." }, { status: 401 });
}

export function badRequestResponse(message = "요청값을 확인해주세요.") {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFoundResponse(message = "요청한 데이터를 찾을 수 없습니다.") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverErrorResponse(context: string, error: unknown, message = "요청 처리 중 오류가 발생했습니다.") {
  console.error(`[${context}]`, error);
  return NextResponse.json({ error: message }, { status: 500 });
}
