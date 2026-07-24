import "dotenv/config";
import { CAMPUS_PASS_JSONLD_CONTEXT } from "@campus-pass/shared";
import { publicClient, walletClient, requireContractAddress, soulboundTokenAbi } from "../src/chain.js";
import { initDb, listStudents, upsertEnrollmentDetails, setStudentTokenUri } from "../src/db.js";
import { pinJson } from "../src/ipfs.js";
import { invalidate, recordCacheKey } from "../src/cache.js";

const IPFS_GATEWAY_URL = process.env.IPFS_GATEWAY_URL ?? "http://127.0.0.1:8081";
const IPFS_API_URL = process.env.IPFS_API_URL ?? "http://127.0.0.1:5001";

interface PinnedMetadata {
  "@type"?: string;
  name?: string;
  description?: string;
  [key: string]: unknown;
}

// Real names and notes were pinned publicly before enrollment_details existed.
// Idempotent: a blob that already has name === serial and no description is skipped.
async function main() {
  if (!walletClient) throw new Error("ORCHESTRATOR_PRIVATE_KEY is not configured");
  await initDb();
  const address = requireContractAddress();

  for (const row of await listStudents()) {
    const label = `${row.gtin}/${row.serial}`;
    if (!row.token_uri) {
      console.log(`clean ${label}`);
      continue;
    }
    const oldCid = row.token_uri.replace(/^ipfs:\/\//, "");
    const res = await fetch(`${IPFS_GATEWAY_URL}/ipfs/${oldCid}`);
    if (!res.ok) throw new Error(`Gateway fetch failed for ${oldCid}: ${res.status}`);
    const metadata = (await res.json()) as PinnedMetadata;

    if (metadata["@type"] !== "Person" || (metadata.name === row.serial && metadata.description === undefined)) {
      console.log(`clean ${label}`);
      continue;
    }

    const parts = (metadata.name ?? row.serial).trim().split(/\s+/);
    const familyName = parts[parts.length - 1];
    const givenName = parts.length > 1 ? parts.slice(0, -1).join(" ") : familyName;
    await upsertEnrollmentDetails(
      { gtin: row.gtin, serial: row.serial, givenName, familyName, email: null, notes: metadata.description ?? null },
      { overwrite: false }
    );

    const { description: _description, ...rest } = metadata;
    const newCid = await pinJson({ ...rest, name: row.serial, "@context": CAMPUS_PASS_JSONLD_CONTEXT });

    const txHash = await walletClient.writeContract({
      address,
      abi: soulboundTokenAbi,
      functionName: "updateTokenURI",
      args: [BigInt(row.token_id), `ipfs://${newCid}`],
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    await setStudentTokenUri(row.gtin, row.serial, `ipfs://${newCid}`);
    await invalidate(recordCacheKey(row.gtin, row.serial));

    const unpin = await fetch(`${IPFS_API_URL}/api/v0/pin/rm?arg=${oldCid}`, { method: "POST" });
    if (!unpin.ok) throw new Error(`Unpin failed for ${oldCid}: ${unpin.status} ${await unpin.text()}`);

    console.log(`scrubbed ${label} ${oldCid} -> ${newCid}`);
  }

  const gc = await fetch(`${IPFS_API_URL}/api/v0/repo/gc`, { method: "POST" });
  if (!gc.ok) throw new Error(`repo gc failed: ${gc.status}`);
  await gc.arrayBuffer();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
