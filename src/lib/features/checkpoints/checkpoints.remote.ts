import { env } from "cloudflare:workers";
import { command, getRequestEvent, query } from "$app/server";
import { getAuthDb } from "../auth/config.server";
import { requireSameOrigin, requireStaff } from "../auth/guards.server";
import { checkInAttendeeInput, listCheckpointsInput } from "./schemas";
import * as service from "./service.server";

export const listScannableCheckpoints = query(
  listCheckpointsInput,
  async (input) => {
    const actor = requireStaff(getRequestEvent().locals.user);
    return service.listScannableCheckpoints(getAuthDb(env), actor.id, input);
  },
);

export const checkInAttendee = command(checkInAttendeeInput, async (input) => {
  const event = getRequestEvent();
  requireSameOrigin(event);
  const actor = requireStaff(event.locals.user);
  return service.checkInAttendee(getAuthDb(env), actor.id, input);
});
