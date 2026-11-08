import { generateKeyPair, exportJWK } from "jose";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const environment = process.argv[2];
if (!["preview", "prod"].includes(environment))
  throw new Error("Usage: bun scripts/certificate-keygen.ts preview|prod");
const directory = resolve("certificate-assets");
await mkdir(directory, { recursive: true });
const kid = `${environment}-${crypto.randomUUID().slice(0, 8)}`;
const pair = await generateKeyPair("ES256", { extractable: true });
const privateKey = { ...(await exportJWK(pair.privateKey)), kid };
const publicKey = { ...(await exportJWK(pair.publicKey)), kid };
await writeFile(
  `${directory}/${kid}.private.json`,
  JSON.stringify(privateKey),
  { mode: 0o600, flag: "wx" },
);
await writeFile(`${directory}/${kid}.public.json`, JSON.stringify(publicKey), {
  mode: 0o600,
  flag: "wx",
});
console.log(
  `Created ${kid} in ignored certificate-assets/. Keep the private file secret; append the public key to the existing key history.`,
);
