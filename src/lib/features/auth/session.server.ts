import type { Cookies } from "@sveltejs/kit";
import { errors, jwtVerify, SignJWT } from "jose";
import type { SessionSettings } from "./config.server";

export const SESSION_TTL_SECONDS = 24 * 60 * 60;
export const CHALLENGE_TTL_SECONDS = 5 * 60;
const ISSUER = "vidyachula";

const audience = (
  settings: SessionSettings,
  purpose: "session" | "google-login",
) =>
  `${ISSUER}:${purpose}:${settings.development ? "development" : "production"}`;

export const sessionCookieName = (development: boolean) =>
  development ? "vidyachula-session-dev" : "__Host-session";

export const challengeCookieName = (development: boolean) =>
  development ? "vidyachula-google-login-dev" : "__Host-google-login";

function cookieOptions(development: boolean) {
  return {
    path: "/",
    httpOnly: true,
    secure: !development,
    sameSite: "lax" as const,
  };
}

export async function issueSessionToken(
  userId: string,
  settings: SessionSettings,
  now = new Date(),
) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAt = issuedAt + SESSION_TTL_SECONDS;
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(audience(settings, "session"))
    .setSubject(userId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(settings.key);
  return { token, expiresAt: new Date(expiresAt * 1000).toISOString() };
}

export async function verifySessionToken(
  token: string,
  settings: SessionSettings,
  now = new Date(),
) {
  try {
    const { payload } = await jwtVerify(token, settings.key, {
      algorithms: ["HS256"],
      typ: "JWT",
      issuer: ISSUER,
      audience: audience(settings, "session"),
      requiredClaims: ["sub", "iat", "exp"],
      maxTokenAge: SESSION_TTL_SECONDS,
      currentDate: now,
    });
    const { sub, iat, exp } = payload;
    if (
      typeof sub !== "string" ||
      !sub ||
      typeof iat !== "number" ||
      !Number.isInteger(iat) ||
      typeof exp !== "number" ||
      !Number.isInteger(exp) ||
      exp - iat !== SESSION_TTL_SECONDS
    )
      return null;
    return {
      userId: sub,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  } catch (cause) {
    if (cause instanceof errors.JOSEError) return null;
    throw cause;
  }
}

export async function setSessionCookie(
  cookies: Cookies,
  userId: string,
  settings: SessionSettings,
) {
  const { token, expiresAt } = await issueSessionToken(userId, settings);
  cookies.set(sessionCookieName(settings.development), token, {
    ...cookieOptions(settings.development),
    maxAge: SESSION_TTL_SECONDS,
    expires: new Date(expiresAt),
  });
  return expiresAt;
}

export function clearSessionCookie(cookies: Cookies, development: boolean) {
  cookies.delete(sessionCookieName(development), cookieOptions(development));
}

export async function beginLoginChallenge(
  cookies: Cookies,
  settings: SessionSettings,
) {
  const nonce = crypto.randomUUID();
  const challenge = await new SignJWT({ nonce })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(audience(settings, "google-login"))
    .setIssuedAt()
    .setExpirationTime(`${CHALLENGE_TTL_SECONDS}s`)
    .sign(settings.key);
  cookies.set(challengeCookieName(settings.development), challenge, {
    ...cookieOptions(settings.development),
    maxAge: CHALLENGE_TTL_SECONDS,
  });
  return nonce;
}

export async function readLoginChallenge(
  cookies: Cookies,
  settings: SessionSettings,
  now = new Date(),
) {
  const token = cookies.get(challengeCookieName(settings.development));
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, settings.key, {
      algorithms: ["HS256"],
      typ: "JWT",
      issuer: ISSUER,
      audience: audience(settings, "google-login"),
      requiredClaims: ["nonce", "iat", "exp"],
      maxTokenAge: CHALLENGE_TTL_SECONDS,
      currentDate: now,
    });
    return typeof payload.nonce === "string" ? payload.nonce : null;
  } catch (cause) {
    if (cause instanceof errors.JOSEError) return null;
    throw cause;
  }
}

export function clearLoginChallenge(cookies: Cookies, development: boolean) {
  cookies.delete(challengeCookieName(development), cookieOptions(development));
}
