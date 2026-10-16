import { error } from "@sveltejs/kit";
import {
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";
import { z } from "zod";

// Reuse the resolver so cached public keys survive across requests in an isolate.
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

const googleIdentity = z.object({
  sub: z.string().min(1).max(255),
  email: z.email(),
  email_verified: z.literal(true),
  name: z.string().min(1).optional(),
  picture: z.url().optional(),
  nonce: z.string().min(1),
});

export type GoogleIdentity = z.infer<typeof googleIdentity>;

const invalidTokenCodes = new Set([
  "ERR_JWT_EXPIRED",
  "ERR_JWT_CLAIM_VALIDATION_FAILED",
  "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
  "ERR_JWS_INVALID",
  "ERR_JWT_INVALID",
  "ERR_JOSE_ALG_NOT_ALLOWED",
  "ERR_JWKS_NO_MATCHING_KEY",
]);

export async function verifyGoogleIdToken(
  token: string,
  clientId: string,
  nonce: string,
  keys: JWTVerifyGetKey = googleKeys,
) {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, keys, {
      algorithms: ["RS256"],
      issuer: ["accounts.google.com", "https://accounts.google.com"],
      audience: clientId,
      requiredClaims: ["sub", "iat", "exp", "nonce", "email", "email_verified"],
      maxTokenAge: "2h",
    }));
  } catch (cause) {
    if (
      cause instanceof errors.JOSEError &&
      invalidTokenCodes.has(cause.code)
    ) {
      error(401, "Invalid Google sign-in token");
    }
    error(503, "Google sign-in verification is temporarily unavailable");
  }

  const parsed = googleIdentity.safeParse(payload);
  if (!parsed.success || parsed.data.nonce !== nonce) {
    error(401, "Invalid Google sign-in token");
  }
  // If Google specifies an authorized party, it must be this web client.
  if (payload.azp !== undefined && payload.azp !== clientId) {
    error(401, "Invalid Google sign-in token");
  }
  return parsed.data;
}
