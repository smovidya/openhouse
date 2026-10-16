import { dev } from "$app/env";
import { env } from "cloudflare:workers";
import { command, getRequestEvent } from "$app/server";
import { error } from "@sveltejs/kit";
import { getSession } from "./auth.remote";
import { requireSameOrigin } from "./guards.server";
import { getAuthDb, getSessionSettings } from "./config.server";
import { devSessionInput } from "./schemas";
import { clearLoginChallenge, setSessionCookie } from "./session.server";

export const createDevSession = command(devSessionInput, async ({ profile }) => {
  // This is a server build-time flag, never an input or an environment toggle.
  if (!dev) error(404, "Not found");
  requireSameOrigin(getRequestEvent());
  const { ensureDevFixture } = await import("./dev-fixtures.server");
  const { cookies, locals } = getRequestEvent();
  const settings = getSessionSettings(env, dev);
  const user = await ensureDevFixture(getAuthDb(env), profile, dev);
  const expiresAt = await setSessionCookie(cookies, user.id, settings);
  clearLoginChallenge(cookies, dev);
  locals.user = user;
  locals.session = { user, expiresAt };
  await getSession().refresh();
  return locals.session;
});
