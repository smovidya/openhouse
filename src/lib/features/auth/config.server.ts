import { error } from "@sveltejs/kit";
import { getDb } from "#db";

export interface SessionSettings {
  key: Uint8Array;
  development: boolean;
}

export function getSessionSettings(
  env: { AUTH_JWT_SECRET?: string } | undefined,
  development: boolean,
): SessionSettings {
  const secret = env?.AUTH_JWT_SECRET;
  // 32 random bytes, hex-encoded. Never fall back to a public/default secret.
  if (!secret || !/^[a-f\d]{64}$/i.test(secret)) {
    error(
      503,
      "AUTH_JWT_SECRET must be configured as 64 hexadecimal characters",
    );
  }
  return {
    key: Uint8Array.from({ length: 32 }, (_, index) =>
      Number.parseInt(secret.slice(index * 2, index * 2 + 2), 16),
    ),
    development,
  };
}

export function getGoogleClientId(
  env: { GOOGLE_CLIENT_ID?: string } | undefined,
) {
  const clientId = env?.GOOGLE_CLIENT_ID;
  if (!clientId) error(503, "GOOGLE_CLIENT_ID is not configured");
  return clientId;
}

export function getAuthDb(env: { DB?: D1Database } | undefined) {
  if (!env?.DB) error(503, "The DB binding is not configured");
  return getDb(env.DB);
}
