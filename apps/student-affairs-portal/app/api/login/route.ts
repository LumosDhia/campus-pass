import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, signSession } from "../../session";

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? "http://localhost:4002";

export async function POST(request: Request) {
  const body = await request.text();

  let upstream: Response;
  try {
    upstream = await fetch(`${ORCHESTRATOR_URL}/registrar/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.ORCHESTRATOR_API_TOKEN}`,
      },
      body,
    });
  } catch {
    return NextResponse.json({ error: "Sign-in service unavailable" }, { status: 502 });
  }

  if (upstream.status === 400) {
    return NextResponse.json({ error: "username and password are required" }, { status: 400 });
  }
  if (upstream.status === 401) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }
  if (!upstream.ok) {
    return NextResponse.json({ error: "Sign-in service unavailable" }, { status: 502 });
  }

  const { username } = (await upstream.json()) as { username: string };
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(SESSION_COOKIE, signSession(username), SESSION_COOKIE_OPTIONS);
  return response;
}
