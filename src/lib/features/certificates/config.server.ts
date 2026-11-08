import { z } from "zod";
import type { JWK } from "jose";
export type CertificateEnv = {
  DB: D1Database;
  CERTIFICATE_ASSETS?: R2Bucket;
  CERTIFICATE_BROWSER?: Fetcher;
  CERTIFICATE_PRIVATE_JWK?: string;
  CERTIFICATE_PUBLIC_KEYS?: string;
  CERTIFICATE_ISSUER?: string;
  CERTIFICATE_EVENT_ORIGIN?: string;
};
const keySchema = z
  .object({
    kid: z.string().min(1).max(64),
    kty: z.literal("EC"),
    crv: z.literal("P-256"),
    x: z.string(),
    y: z.string(),
    disabled: z.boolean().optional(),
  })
  .strict();
export function certificateConfig(env: CertificateEnv) {
  const issuer = new URL(
    env.CERTIFICATE_ISSUER || "https://verify.vidyachula.org",
  );
  const eventOrigin = new URL(
    env.CERTIFICATE_EVENT_ORIGIN || "https://scichulaopenhouse.com",
  );
  if (
    issuer.origin !== issuer.href.replace(/\/$/, "") ||
    eventOrigin.origin !== eventOrigin.href.replace(/\/$/, "")
  )
    throw new Error("Certificate origins must not contain paths");
  if (issuer.protocol !== "https:" || eventOrigin.protocol !== "https:")
    throw new Error("Certificate origins must use HTTPS");
  const production = eventOrigin.hostname === "scichulaopenhouse.com";
  if (production !== (issuer.hostname === "verify.vidyachula.org"))
    throw new Error("Preview must use a separate verification origin and keys");
  const keys = z
    .array(keySchema)
    .parse(JSON.parse(env.CERTIFICATE_PUBLIC_KEYS || "[]"));
  const namespace = production ? "prod-" : "preview-";
  if (keys.some((key) => !key.kid.startsWith(namespace)))
    throw new Error("Certificate key environment mismatch");
  if (new Set(keys.map((key) => key.kid)).size !== keys.length)
    throw new Error("Duplicate certificate key IDs");
  return {
    issuer: issuer.origin,
    eventOrigin: eventOrigin.origin,
    audience: "sci-cert",
    keys,
  };
}
export function publicKeys(env: CertificateEnv) {
  return certificateConfig(env)
    .keys.filter((key) => !key.disabled)
    .map(({ disabled: _disabled, ...key }) => ({
      ...key,
      alg: "ES256",
      use: "sig",
    }));
}
export function signingJwk(env: CertificateEnv): JWK & { kid: string } {
  const key = JSON.parse(env.CERTIFICATE_PRIVATE_JWK || "null");
  const config = certificateConfig(env);
  const published = config.keys.find(
    (entry) => entry.kid === key?.kid && !entry.disabled,
  );
  if (
    !published ||
    key.kty !== "EC" ||
    key.crv !== "P-256" ||
    !key.d ||
    key.x !== published.x ||
    key.y !== published.y
  )
    throw new Error("Certificate signing key unavailable");
  return key;
}
export function certificateConfigured(env: CertificateEnv) {
  try {
    signingJwk(env);
    return Boolean(env.CERTIFICATE_ASSETS && env.CERTIFICATE_BROWSER);
  } catch {
    return false;
  }
}
