// Template for the GS1 Resolver documents of one program. The resolver's
// POST /new is not an upsert across the base + serialized pair, so we delete
// the anchor first (same reasoning as the old ops/resolver-entries/load.sh).
export async function syncProgramResolverEntry(code: string, name: string): Promise<void> {
  const apiUrl = process.env.RESOLVER_API_URL ?? "http://localhost:8090/api";
  const token = process.env.RESOLVER_SESSION_TOKEN ?? "secret";
  const ssoBase = process.env.SSO_BASE_URL ?? "http://localhost:4001";
  const headers = { Authorization: `Bearer ${token}` };

  const loginUrl = `${ssoBase}/moodle/login/${code}`;
  const link = (href: string, title: string) => ({
    linktype: "gs1:authenticate",
    href,
    title,
    type: "text/html",
    hreflang: ["en"],
  });
  const description = `CampusPass member credential — ${name}`;
  const documents = [
    {
      anchor: `/01/${code}`,
      itemDescription: description,
      defaultLinktype: "gs1:authenticate",
      links: [link(loginUrl, "CampusPass login (no specific member — program only)")],
    },
    {
      anchor: `/01/${code}`,
      itemDescription: `${description} (serialized)`,
      defaultLinktype: "gs1:authenticate",
      links: [link(`${loginUrl}?serial={studentId}`, "CampusPass login")],
      qualifiers: [{ "21": "{studentId}" }],
    },
  ];

  const del = await fetch(`${apiUrl}/01/${code}`, { method: "DELETE", headers });
  if (!del.ok && del.status !== 404) {
    throw new Error(`resolver ${del.status}: ${await del.text()}`);
  }

  const res = await fetch(`${apiUrl}/new`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(documents),
  });
  if (!res.ok) {
    throw new Error(`resolver ${res.status}: ${await res.text()}`);
  }
}
