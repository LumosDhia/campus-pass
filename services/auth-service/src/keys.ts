import { readFile } from "node:fs/promises";
import { exportJWK, importPKCS8, importSPKI, type KeyLike } from "jose";

export interface HubKeys {
  privateKey: KeyLike;
  publicJwk: Record<string, unknown>;
  kid: string;
}

export async function loadKeys(kid: string): Promise<HubKeys> {
  const [privatePem, publicPem] = await Promise.all([
    readFile(new URL("../keys/private.pem", import.meta.url), "utf8").catch(() => {
      throw new Error("Missing keys/private.pem — run `pnpm generate-keys` in services/auth-service first.");
    }),
    readFile(new URL("../keys/public.pem", import.meta.url), "utf8"),
  ]);

  const privateKey = await importPKCS8(privatePem, "RS256");
  const publicKey = await importSPKI(publicPem, "RS256");
  const publicJwk = { ...(await exportJWK(publicKey)), use: "sig", alg: "RS256", kid };

  return { privateKey, publicJwk, kid };
}
