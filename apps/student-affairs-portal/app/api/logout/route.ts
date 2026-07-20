import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "../../session";

export async function POST() {
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return response;
}
