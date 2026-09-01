import "dotenv/config";
import { publicClient, requireContractAddress, soulboundTokenAbi } from "../src/chain.js";
import { initDb, upsertStudent, setStudentActive, resyncClaims } from "../src/db.js";

const IPFS_GATEWAY_URL = process.env.IPFS_GATEWAY_URL ?? "http://127.0.0.1:8081";

// One-time (but safe to re-run) sync from chain -> Postgres for anything minted
// before students_index/claims_index existed. Ongoing writes since then already
// happen inline in index.ts on every mint/revoke/claim — this only covers the
// gap for history that predates those tables.
async function fetchMetadataName(tokenURI: string): Promise<string | undefined> {
  try {
    const cid = tokenURI.replace(/^ipfs:\/\//, "");
    const res = await fetch(`${IPFS_GATEWAY_URL}/ipfs/${cid}`);
    if (!res.ok) return undefined;
    const metadata = (await res.json()) as { name?: string };
    return metadata.name;
  } catch {
    return undefined;
  }
}

async function main() {
  await initDb();
  const address = requireContractAddress();

  const logs = await publicClient.getContractEvents({
    address,
    abi: soulboundTokenAbi,
    eventName: "Minted",
    fromBlock: 0n,
    toBlock: "latest",
  });

  console.log(`Found ${logs.length} Minted event(s) on-chain. Syncing to Postgres...`);

  for (const log of logs) {
    const { tokenId, to, gtin, serial, tokenURI } = log.args;
    if (tokenId === undefined || !to || !gtin || !serial || !tokenURI) continue;

    const [active, claims, name] = await Promise.all([
      publicClient.readContract({ address, abi: soulboundTokenAbi, functionName: "isActiveFor", args: [gtin, serial] }),
      publicClient.readContract({ address, abi: soulboundTokenAbi, functionName: "getClaims", args: [tokenId] }),
      fetchMetadataName(tokenURI),
    ]);

    await upsertStudent({ gtin, serial, tokenId: tokenId.toString(), ownerAddress: to, tokenURI, name });
    await setStudentActive(gtin, serial, active); // upsertStudent's INSERT path always defaults active=true

    await resyncClaims(
      gtin,
      serial,
      claims.map((claim) => ({
        label: claim.label,
        value: claim.value,
        loggedAt: new Date(Number(claim.timestamp) * 1000),
      }))
    );

    console.log(`  synced ${gtin}/${serial} (token ${tokenId}, ${claims.length} claim(s), active=${active})`);
  }

  console.log("Backfill complete.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
