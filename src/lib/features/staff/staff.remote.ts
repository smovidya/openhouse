import { env } from "cloudflare:workers";
import { command, getRequestEvent, query } from "$app/server";
import { getAuthDb } from "../auth/config.server";
import { requireSameOrigin, requireUser } from "../auth/guards.server";
import { getSession } from "../auth/auth.remote";
import type { AuthUser } from "../auth/schemas";
import {
  createInviteInput,
  disableInviteInput,
  enrollStaffInput,
  listInvitesInput,
  redeemInviteInput,
} from "./schemas";
import * as service from "./service.server";

function requestContext(mutation = false) {
  const event = getRequestEvent();
  if (mutation) requireSameOrigin(event);
  return { db: getAuthDb(env), actorId: requireUser(event.locals.user).id };
}

async function updateSession(user: AuthUser) {
  const { locals } = getRequestEvent();
  // Promotion keeps the existing 24-hour expiry; it does not renew the token.
  const session = locals.session!;
  locals.user = user;
  locals.session = { user, expiresAt: session.expiresAt };
  await getSession().refresh();
  await getMyStaffProfile().refresh();
  return locals.session;
}

export const getMyStaffProfile = query(async () => {
  const { db, actorId } = requestContext();
  return service.getStaffProfile(db, actorId);
});

export const listBoothDepartments = query(async () => {
  const { db, actorId } = requestContext();
  return service.listBoothDepartments(db, actorId);
});

export const enrollStaff = command(enrollStaffInput, async (input) => {
  const { db, actorId } = requestContext(true);
  return updateSession(await service.enrollStaff(db, actorId, input));
});

export const redeemInviteCode = command(redeemInviteInput, async ({ code }) => {
  const { db, actorId } = requestContext(true);
  return updateSession(await service.redeemInviteCode(db, actorId, code));
});

export const createInviteCode = command(
  createInviteInput,
  async ({ permission, code }) => {
    const { db, actorId } = requestContext(true);
    return service.createInviteCode(db, actorId, permission, code);
  },
);

export const listInviteCodes = query(listInvitesInput, async (input) => {
  const { db, actorId } = requestContext();
  return service.listInviteCodes(db, actorId, input);
});

export const disableInviteCode = command(disableInviteInput, async ({ id }) => {
  const { db, actorId } = requestContext(true);
  return service.disableInviteCode(db, actorId, id);
});
