import { dev } from "$app/env";
import { env } from "cloudflare:workers";
// Register the backend API even before any client component imports it.
import "#lib/features/auth/auth.remote.ts";
import "#lib/features/auth/dev.remote.ts";
import "#lib/features/attendees/attendees.remote.ts";
import "#lib/features/staff/staff.remote.ts";
import "#lib/features/checkpoints/checkpoints.remote.ts";
import "#lib/features/rewards/rewards.remote.ts";
import "#lib/features/workshops/attendance.remote.ts";
import "#lib/features/time/time.remote.ts";
import "#lib/features/workshops/workshops.remote.ts";
import "#lib/features/certificates/certificates.remote.ts";
import type { Handle } from "@sveltejs/kit/hooks";
import {
  getAuthDb,
  getSessionSettings,
} from "#lib/features/auth/config.server.ts";
import { findSessionUser } from "#lib/features/auth/service.server.ts";
import {
  clearSessionCookie,
  sessionCookieName,
  verifySessionToken,
} from "#lib/features/auth/session.server.ts";

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = null;
  event.locals.session = null;
  event.locals.certificateOperationsAllowed =
    event.url.origin ===
      ((env as { CERTIFICATE_EVENT_ORIGIN?: string })
        .CERTIFICATE_EVENT_ORIGIN || "https://scichulaopenhouse.com") ||
    (dev && ["localhost", "127.0.0.1"].includes(event.url.hostname));
  // Host separation must continue to work even when a certificate key is misconfigured.
  const certificateHost =
    event.url.origin ===
    ((env as { CERTIFICATE_ISSUER?: string }).CERTIFICATE_ISSUER ||
      "https://verify.vidyachula.org");
  const verificationPath =
    event.url.pathname.startsWith("/c/") ||
    event.url.pathname === "/.well-known/jwks.json";
  if (certificateHost) {
    const asset =
      event.url.pathname.startsWith("/_app/immutable/") ||
      event.url.pathname === "/_app/version.json" ||
      event.url.pathname.startsWith("/fonts/");
    if (!verificationPath && !asset)
      return new Response("Not found", { status: 404 });
    if (asset) return resolve(event);
  }
  if (verificationPath) {
    if (!certificateHost && !dev)
      return new Response("Not found", { status: 404 });
    const response = await resolve(event);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  }
  const token = event.cookies.get(sessionCookieName(dev));
  if (token) {
    const settings = getSessionSettings(env, dev);
    const session = await verifySessionToken(token, settings);
    const user = session
      ? await findSessionUser(getAuthDb(env), session.userId)
      : null;
    if (session && user) {
      event.locals.user = user;
      event.locals.session = { user, expiresAt: session.expiresAt };
    } else {
      clearSessionCookie(event.cookies, dev);
    }
  }
  return resolve(event);
};
