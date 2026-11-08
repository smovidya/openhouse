import { importJWK, compactVerify, CompactSign } from "jose";
import { z } from "zod";
import {
  nameSnapshotSchema,
  CERTIFICATE_EVENT,
  type NameSnapshot,
} from "./shared";
import {
  certificateConfig,
  signingJwk,
  type CertificateEnv,
} from "./config.server";
// Compact tuples are compressed before signing; legacy cert+jwt remains readable.
// n = title, first name, last name, school; e = ID, title, start, end, award date, type.
export const claimsSchema = z
  .object({
    ver: z.literal(1),
    jti: z.string().uuid(),
    iss: z.string(),
    aud: z.string(),
    iat: z.number().int().nonnegative(),
    n: z.tuple([
      z.string().min(1).max(120),
      z.string().min(1).max(120),
      z.string().min(1).max(120),
      z.string().max(180),
    ]),
    e: z.tuple([
      z.string().min(1).max(80),
      z.string().min(1).max(160),
      z.iso.datetime({ offset: true }),
      z.iso.datetime({ offset: true }),
      z.iso.date(),
      z.literal("participation"),
    ]),
  })
  .strict();
const MAX_CLAIMS_BYTES = 4096;
const COMPRESSED_TYPE = "cert+deflate";

async function compressedClaims(json: string) {
  if (new TextEncoder().encode(json).length > MAX_CLAIMS_BYTES)
    throw new Error("ข้อมูลยาวเกินกว่าจะสร้าง QR ได้");
  return new Uint8Array(
    await new Response(
      new Blob([json])
        .stream()
        .pipeThrough(new CompressionStream("deflate-raw")),
    ).arrayBuffer(),
  );
}

async function decodedClaims(payload: Uint8Array, compressed: boolean) {
  const input = new Blob([new Uint8Array(payload)]).stream();
  const reader = (
    compressed
      ? input.pipeThrough(new DecompressionStream("deflate-raw"))
      : input
  ).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_CLAIMS_BYTES)
        throw new Error("Certificate claims too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(output));
}

export async function signCertificate(
  env: CertificateEnv,
  input: {
    id: string;
    certificateId: string;
    name: NameSnapshot;
    now: number;
    event?: typeof CERTIFICATE_EVENT;
  },
) {
  const config = certificateConfig(env);
  const jwk = signingJwk(env);
  const key = await importJWK(jwk, "ES256");
  const event = input.event ?? CERTIFICATE_EVENT;
  const claims = claimsSchema.parse({
    ver: 1,
    jti: input.id,
    iss: config.issuer,
    aud: config.audience,
    iat: input.now,
    n: [
      input.name.title,
      input.name.firstName,
      input.name.lastName,
      input.name.school,
    ],
    e: [
      event.id,
      event.title,
      event.startsAt,
      event.endsAt,
      event.awardDate,
      event.type,
    ],
  });
  // This is a compact JWS over DEFLATE bytes, explicitly not labelled as a JSON JWT.
  // Authenticate the compressed bytes before any verification-side decompression.
  return new CompactSign(await compressedClaims(JSON.stringify(claims)))
    .setProtectedHeader({ alg: "ES256", kid: jwk.kid, typ: COMPRESSED_TYPE })
    .sign(key);
}
export async function verifyCertificateToken(
  env: CertificateEnv,
  token: string,
) {
  if (
    new TextEncoder().encode(token).length > 4096 ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
  )
    throw new Error("Invalid token");
  const config = certificateConfig(env);
  const result = await compactVerify(
    token,
    async (header) => {
      if (
        header.alg !== "ES256" ||
        !["cert+jwt", COMPRESSED_TYPE].includes(header.typ ?? "") ||
        typeof header.kid !== "string" ||
        Object.keys(header).some((key) => !["alg", "typ", "kid"].includes(key))
      )
        throw new Error("Invalid certificate header");
      const key = config.keys.find(
        (key) => key.kid === header.kid && !key.disabled,
      );
      if (!key) throw new Error("Unknown signing key");
      return importJWK(key, "ES256");
    },
    { algorithms: ["ES256"] },
  );
  const claims = claimsSchema.parse(
    await decodedClaims(
      result.payload,
      result.protectedHeader.typ === COMPRESSED_TYPE,
    ),
  );
  if (
    claims.iss !== config.issuer ||
    claims.aud !== config.audience ||
    claims.iat > Math.floor(Date.now() / 1000) + 5
  )
    throw new Error("Invalid certificate claims");
  const [title, firstName, lastName, school] = claims.n;
  const [id, eventTitle, startsAt, endsAt, awardDate, type] = claims.e;
  const name = nameSnapshotSchema.parse({
    title,
    firstName,
    lastName,
    school,
    displayName: `${title} ${firstName} ${lastName}`,
  });
  if (Date.parse(endsAt) < Date.parse(startsAt))
    throw new Error("Invalid event range");
  return {
    jti: claims.jti,
    iat: claims.iat,
    iss: claims.iss,
    aud: claims.aud,
    ver: claims.ver,
    name,
    event: { id, title: eventTitle, startsAt, endsAt, awardDate, type },
  };
}
export function verificationUrl(env: CertificateEnv, token: string) {
  if (new TextEncoder().encode(token).length > 4096)
    throw new Error("ข้อมูลยาวเกินกว่าจะสร้าง QR ได้");
  return `${certificateConfig(env).issuer}/c/${token}`;
}
