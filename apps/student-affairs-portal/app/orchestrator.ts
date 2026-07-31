const ORCHESTRATOR_URL = "/api/orchestrator";

export async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${ORCHESTRATOR_URL}${path}`, init);
  if (res.status === 401) {
    window.location.assign("/login");
    throw new Error("Not signed in");
  }
  return res;
}

export interface Program {
  code: string;
  name: string;
}
