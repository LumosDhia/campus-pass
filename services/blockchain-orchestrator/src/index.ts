import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { CAMPUS_PASS_JSONLD_CONTEXT, type DppMetadata } from "@campus-pass/shared";
import { publicClient, walletClient, requireContractAddress, soulboundTokenAbi } from "./chain.js";
import { pinJson } from "./ipfs.js";
import { cached, invalidate, statusCacheKey, recordCacheKey } from "./cache.js";
import { buildGs1DigitalLinkUri } from "./gs1.js";
import { requireServiceToken, verifyPassword } from "./auth.js";
import { initDb, getRegistrarHash, listPrograms, insertProgram, upsertStudent, setStudentActive, listStudents, insertClaim, listClaims } from "./db.js";

const PORT = Number(process.env.PORT ?? 4002);
const app = Fastify({ logger: true });

await initDb();

// Permissive for local dev only — the Student Passport calls the read endpoints
// directly from the browser (writes come from the portal's server and need the
// service token). Tighten to an explicit origin allowlist before this is ever
// exposed beyond localhost.
await app.register(cors, { origin: true });

app.addHook("onRequest", async (request, reply) => {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  return requireServiceToken(request, reply);
});

app.get("/health", async () => ({ status: "ok" }));

// Called only by the portal's server-side login route, which holds the service token.
app.post<{ Body: { username?: string; password?: string } }>("/registrar/login", async (request, reply) => {
  const { username, password } = request.body ?? {};
  if (!username || !password) {
    return reply.code(400).send({ error: "username and password are required" });
  }
  const stored = await getRegistrarHash(username);
  if (!verifyPassword(password, stored)) {
    return reply.code(401).send({ error: "Invalid username or password" });
  }
  return reply.send({ username });
});

async function resolveTokenId(gtin: string, serial: string) {
  const address = requireContractAddress();
  const tokenId = await publicClient.readContract({
    address,
    abi: soulboundTokenAbi,
    functionName: "tokenIdFor",
    args: [gtin, serial],
  });
  return tokenId === 0n ? null : tokenId;
}

// Pins DPP JSON-LD metadata to IPFS without minting — used by the Enterprise
// Portal to preview/validate metadata before committing an SBT on-chain.
app.post<{ Body: DppMetadata }>("/metadata", async (request, reply) => {
  const cid = await pinJson({ ...request.body, "@context": CAMPUS_PASS_JSONLD_CONTEXT });
  return reply.send({ cid, uri: `ipfs://${cid}` });
});

interface MintBody {
  gtin: string;
  serial: string;
  ownerAddress: `0x${string}`;
  metadata: DppMetadata;
}

// Pins metadata, then mints the Soulbound Token referencing it (HLD §2.1.3).
app.post<{ Body: MintBody }>("/mint", async (request, reply) => {
  if (!walletClient) {
    return reply.code(500).send({ error: "ORCHESTRATOR_PRIVATE_KEY is not configured" });
  }
  const { gtin, serial, ownerAddress, metadata } = request.body;
  const address = requireContractAddress();

  const cid = await pinJson({ ...metadata, "@context": CAMPUS_PASS_JSONLD_CONTEXT });
  const tokenURI = `ipfs://${cid}`;

  const txHash = await walletClient.writeContract({
    address,
    abi: soulboundTokenAbi,
    functionName: "mint",
    args: [ownerAddress, gtin, serial, tokenURI],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  const tokenId = await publicClient.readContract({
    address,
    abi: soulboundTokenAbi,
    functionName: "tokenIdFor",
    args: [gtin, serial],
  });

  await upsertStudent({ gtin, serial, tokenId: tokenId.toString(), ownerAddress, tokenURI, name: metadata.name });

  return reply.send({
    tokenId: tokenId.toString(),
    cid,
    tokenURI,
    txHash,
    gs1Uri: buildGs1DigitalLinkUri(gtin, serial),
  });
});

interface BatchMintBody {
  items: MintBody[];
}

// "API for mass-encoding NFC tags for the logistical center" (HLD §6 Phase 5).
// Mints sequentially (not in parallel) so a failure partway through leaves a
// clear boundary between what minted and what didn't, rather than a partial
// interleaved mess — acceptable for the batch sizes a logistics run needs locally.
app.post<{ Body: BatchMintBody }>("/mint/batch", async (request, reply) => {
  if (!walletClient) {
    return reply.code(500).send({ error: "ORCHESTRATOR_PRIVATE_KEY is not configured" });
  }
  const address = requireContractAddress();
  const results: Array<
    | { gtin: string; serial: string; ok: true; tokenId: string; cid: string; tokenURI: string; txHash: string; gs1Uri: string }
    | { gtin: string; serial: string; ok: false; error: string }
  > = [];

  for (const item of request.body.items) {
    try {
      const cid = await pinJson({ ...item.metadata, "@context": CAMPUS_PASS_JSONLD_CONTEXT });
      const tokenURI = `ipfs://${cid}`;
      const txHash = await walletClient.writeContract({
        address,
        abi: soulboundTokenAbi,
        functionName: "mint",
        args: [item.ownerAddress, item.gtin, item.serial, tokenURI],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      const tokenId = await publicClient.readContract({
        address,
        abi: soulboundTokenAbi,
        functionName: "tokenIdFor",
        args: [item.gtin, item.serial],
      });
      await upsertStudent({
        gtin: item.gtin,
        serial: item.serial,
        tokenId: tokenId.toString(),
        ownerAddress: item.ownerAddress,
        tokenURI,
        name: item.metadata.name,
      });

      results.push({
        gtin: item.gtin,
        serial: item.serial,
        ok: true,
        tokenId: tokenId.toString(),
        cid,
        tokenURI,
        txHash,
        gs1Uri: buildGs1DigitalLinkUri(item.gtin, item.serial),
      });
    } catch (error) {
      results.push({
        gtin: item.gtin,
        serial: item.serial,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return reply.send({ results });
});

// Checked by the Auth Service (HLD §5 step 3) before issuing a JWT.
// Redis-cached per HLD §7 — this is the "Blockchain verification" the high-traffic
// caching requirement is about; see DECISIONS.md for why it lives here, not in the resolver.
app.get<{ Params: { gtin: string; serial: string } }>("/sbt/:gtin/:serial/status", async (request, reply) => {
  const { gtin, serial } = request.params;
  const address = requireContractAddress();

  try {
    const result = await cached(statusCacheKey(gtin, serial), async () => {
      const active = await publicClient.readContract({
        address,
        abi: soulboundTokenAbi,
        functionName: "isActiveFor",
        args: [gtin, serial],
      });
      return { active };
    });
    return reply.send(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("UnknownItem")) {
      return reply.code(404).send({ error: "No SBT minted for this item" });
    }
    request.log.error(error);
    return reply.code(502).send({ error: "Chain read failed" });
  }
});

// Full record for one item — used by the Public DPP Portal to resolve the
// tokenURI it then fetches from IPFS. Also Redis-cached (HLD §7).
app.get<{ Params: { gtin: string; serial: string } }>("/sbt/:gtin/:serial", async (request, reply) => {
  const { gtin, serial } = request.params;
  const address = requireContractAddress();

  const tokenId = await resolveTokenId(gtin, serial);
  if (tokenId === null) {
    return reply.code(404).send({ error: "No SBT minted for this item" });
  }

  const result = await cached(recordCacheKey(gtin, serial), async () => {
    const [owner, tokenURI, active] = await Promise.all([
      publicClient.readContract({ address, abi: soulboundTokenAbi, functionName: "ownerOf", args: [tokenId] }),
      publicClient.readContract({ address, abi: soulboundTokenAbi, functionName: "tokenURI", args: [tokenId] }),
      publicClient.readContract({ address, abi: soulboundTokenAbi, functionName: "isActiveFor", args: [gtin, serial] }),
    ]);
    return { tokenId: tokenId.toString(), owner, tokenURI, active, gs1Uri: buildGs1DigitalLinkUri(gtin, serial) };
  });

  return reply.send(result);
});

interface SetActiveBody {
  active: boolean;
}

// Revoke/reactivate a credential (e.g. student withdraws, warranty voided).
// Invalidates the Redis cache so the change is visible immediately, not after TTL.
app.post<{ Params: { gtin: string; serial: string }; Body: SetActiveBody }>(
  "/sbt/:gtin/:serial/active",
  async (request, reply) => {
    if (!walletClient) {
      return reply.code(500).send({ error: "ORCHESTRATOR_PRIVATE_KEY is not configured" });
    }
    const { gtin, serial } = request.params;
    const address = requireContractAddress();

    const tokenId = await resolveTokenId(gtin, serial);
    if (tokenId === null) {
      return reply.code(404).send({ error: "No SBT minted for this item" });
    }

    const txHash = await walletClient.writeContract({
      address,
      abi: soulboundTokenAbi,
      functionName: "setActive",
      args: [tokenId, request.body.active],
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    await invalidate(statusCacheKey(gtin, serial), recordCacheKey(gtin, serial));
    await setStudentActive(gtin, serial, request.body.active);

    return reply.send({ txHash, active: request.body.active });
  }
);

// Backs the Student Affairs Portal's roster view. Reads the Postgres index
// (written on every mint/revoke) instead of replaying every Minted event from
// block 0 — the chain stays authoritative, this is just a fast read cache.
app.get("/items", async (_request, reply) => {
  const rows = await listStudents();
  const items = rows.map((row) => ({
    tokenId: row.token_id,
    owner: row.owner_address,
    gtin: row.gtin,
    serial: row.serial,
    tokenURI: row.token_uri,
    name: row.name,
    active: row.active,
  }));

  return reply.send({ items });
});

// Programs have no on-chain representation (a program code is just the gtin
// half of a student's identifier pair) — this is the one thing Postgres is the
// actual source of truth for, not just a cache of it.
app.get("/programs", async (_request, reply) => {
  const programs = await listPrograms();
  return reply.send({ programs });
});

interface CreateProgramBody {
  code: string;
  name: string;
}

app.post<{ Body: CreateProgramBody }>("/programs", async (request, reply) => {
  const { code, name } = request.body;
  if (!code || !name) {
    return reply.code(400).send({ error: "code and name are required" });
  }
  await insertProgram(code, name);
  return reply.send({ code, name });
});

// The permanent, append-only record attached to one token (HLD extension: e.g.
// certifications, volunteer hours, or corrections logged after minting).
// Reads the Postgres index — the on-chain getClaims() call remains the
// authoritative source (see the POST handler below, which writes both).
app.get<{ Params: { gtin: string; serial: string } }>("/sbt/:gtin/:serial/claims", async (request, reply) => {
  const { gtin, serial } = request.params;

  const tokenId = await resolveTokenId(gtin, serial);
  if (tokenId === null) {
    return reply.code(404).send({ error: "No SBT minted for this item" });
  }

  const claims = await listClaims(gtin, serial);

  return reply.send({
    claims: claims.map((claim) => ({
      label: claim.label,
      value: claim.value,
      timestamp: claim.logged_at.toISOString(),
    })),
  });
});

interface AddClaimBody {
  label: string;
  value: string;
}

// Appends one fact to a token's record without minting a new token or touching
// the base metadata — the mechanism behind "add information to an SBT after the fact".
app.post<{ Params: { gtin: string; serial: string }; Body: AddClaimBody }>(
  "/sbt/:gtin/:serial/claims",
  async (request, reply) => {
    if (!walletClient) {
      return reply.code(500).send({ error: "ORCHESTRATOR_PRIVATE_KEY is not configured" });
    }
    const { gtin, serial } = request.params;
    const { label, value } = request.body;
    const address = requireContractAddress();

    const tokenId = await resolveTokenId(gtin, serial);
    if (tokenId === null) {
      return reply.code(404).send({ error: "No SBT minted for this item" });
    }

    const txHash = await walletClient.writeContract({
      address,
      abi: soulboundTokenAbi,
      functionName: "addClaim",
      args: [tokenId, label, value],
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    await insertClaim(gtin, serial, label, value);

    return reply.send({ txHash });
  }
);

app.listen({ port: PORT, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
