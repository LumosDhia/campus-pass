import { mkdir, writeFile } from "node:fs/promises";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";

async function main() {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { modulusLength: 2048 });

  const privatePem = await exportPKCS8(privateKey);
  const publicPem = await exportSPKI(publicKey);

  await mkdir(new URL("../keys/", import.meta.url), { recursive: true });
  await writeFile(new URL("../keys/private.pem", import.meta.url), privatePem);
  await writeFile(new URL("../keys/public.pem", import.meta.url), publicPem);

  console.log("Generated RS256 keypair in services/auth-service/keys/ (gitignored, dev-only).");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
