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
