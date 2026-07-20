import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "../../../session";

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? "http://localhost:4002";

async function proxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (!verifySession(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { path } = await params;
  const target = `${ORCHESTRATOR_URL}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const headers: Record<string, string> = {
    authorization: `Bearer ${process.env.ORCHESTRATOR_API_TOKEN}`,
  };
  const contentType = request.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" ? undefined : await request.text(),
    cache: "no-store",
  });

  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export { proxy as GET, proxy as POST };
