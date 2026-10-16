import { dev } from "$app/env";
import { env } from "cloudflare:workers";
import { command, getRequestEvent, query } from "$app/server";
import { error } from "@sveltejs/kit";
import { getAuthDb, getGoogleClientId, getSessionSettings } from "./config.server";
import { verifyGoogleIdToken } from "./google.server";
import { requireSameOrigin } from "./guards.server";
import { googleSignInInput } from "./schemas";
import { findOrCreateGoogleUser } from "./service.server";
import {
  beginLoginChallenge,
  clearLoginChallenge,
  clearSessionCookie,
  readLoginChallenge,
  setSessionCookie,
} from "./session.server";

export const getSession = query(() => getRequestEvent().locals.session);

export const beginGoogleSignIn = command(async () => {
  requireSameOrigin(getRequestEvent());
  const { cookies } = getRequestEvent();
  const clientId = getGoogleClientId(env);
  const settings = getSessionSettings(env, dev);
  const nonce = await beginLoginChallenge(cookies, settings);
  return { clientId, nonce };
});

export const signInWithGoogle = command(googleSignInInput, async ({ googleIdToken }) => {
  requireSameOrigin(getRequestEvent());
  const { cookies, locals } = getRequestEvent();
  const settings = getSessionSettings(env, dev);
  const nonce = await readLoginChallenge(cookies, settings);
  if (!nonce) error(401, "Start a new Google sign-in attempt");
  const identity = await verifyGoogleIdToken(
    googleIdToken, getGoogleClientId(env), nonce,
  );
  const user = await findOrCreateGoogleUser(getAuthDb(env), identity);
  const expiresAt = await setSessionCookie(cookies, user.id, settings);
  clearLoginChallenge(cookies, dev);
  locals.user = user;
  locals.session = { user, expiresAt };
  await getSession().refresh();
  return locals.session;
});

export const logout = command(async () => {
  requireSameOrigin(getRequestEvent());
  const { cookies, locals } = getRequestEvent();
  clearSessionCookie(cookies, dev);
  clearLoginChallenge(cookies, dev);
  locals.user = null;
  locals.session = null;
  await getSession().refresh();
  return { success: true };
});
