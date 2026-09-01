const IPFS_API_URL = process.env.IPFS_API_URL ?? "http://127.0.0.1:5001";

/** Pins JSON-LD metadata to the local Kubo IPFS node and returns its CID. */
export async function pinJson(metadata: unknown): Promise<string> {
  const body = new FormData();
  body.append(
    "file",
    new Blob([JSON.stringify(metadata, null, 2)], { type: "application/json" }),
    "metadata.json"
  );

  const res = await fetch(`${IPFS_API_URL}/api/v0/add?pin=true`, { method: "POST", body });
  if (!res.ok) {
    throw new Error(`IPFS add failed: ${res.status} ${await res.text()}`);
  }

  const { Hash } = (await res.json()) as { Hash: string };
  return Hash;
}
