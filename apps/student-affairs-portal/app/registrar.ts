import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "./session";

// Display only: an invalid or missing session still renders, and the client-side
// 401 redirect on the first orchestrator call remains the actual gate.
export async function registrarName(): Promise<string> {
  const store = await cookies();
  try {
    return verifySession(store.get(SESSION_COOKIE)?.value) ?? "";
  } catch {
    return "";
  }
}
