import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { CERTIFICATE_TEMPLATE as template } from "../src/lib/features/certificates/template";
const mode = process.argv[2];
if (!["local", "preview", "production"].includes(mode))
  throw new Error(
    "Usage: bun scripts/certificate-assets.ts local|preview|production",
  );
const assets = [
  { ...template.background, file: "เกียรติบัตร.png" },
  { ...template.font, file: "certificate-assets/Sarabun-Regular.ttf" },
];
for (const asset of assets) {
  const bytes = await readFile(asset.file);
  if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256)
    throw new Error(`Checksum mismatch: ${asset.file}`);
}
const bucket = `openhouse-certificates-${mode}`;
for (const asset of assets) {
  const result = spawnSync(
    "bunx",
    [
      "wrangler",
      "r2",
      "object",
      "put",
      `${bucket}/${asset.key}`,
      "--file",
      asset.file,
      mode === "local" ? "--local" : "--remote",
      ...(mode === "local" ? [] : ["--env", "production"]),
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
