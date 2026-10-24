import { env } from "cloudflare:workers";
import { command, getRequestEvent, query } from "$app/server";
import { getAuthDb } from "../auth/config.server";
import {
  requireSameOrigin,
  requireStaff,
  requireUser,
} from "../auth/guards.server";
import {
  attendeeLogsInput,
  attendeeProgressInput,
  checkInAttendeeInput,
  listCheckpointsInput,
  removeStageAttendanceInput,
} from "./schemas";
import * as service from "./service.server";
import { getMyProgress as readMyProgress } from "./progress.server";

export const listScannableCheckpoints = query(
  listCheckpointsInput,
  async (input) => {
    const actor = requireStaff(getRequestEvent().locals.user);
    return service.listScannableCheckpoints(getAuthDb(env), actor.id, input);
  },
);

// No attendee ID is accepted from the client for this read.
export const getMyProgress = query(async () => {
  const actor = requireUser(getRequestEvent().locals.user);
  return readMyProgress(getAuthDb(env), actor.id);
});

export const getStaffAttendeeProgress = query(
  attendeeProgressInput,
  async (input) => {
    const actor = requireStaff(getRequestEvent().locals.user);
    return service.getStaffAttendeeProgress(
      getAuthDb(env),
      actor.id,
      input.qrCodeId,
    );
  },
);

export const listAttendeeCheckpointLogs = query(
  attendeeLogsInput,
  async (input) => {
    const actor = requireStaff(getRequestEvent().locals.user);
    return service.listAttendeeCheckpointLogs(getAuthDb(env), actor.id, input);
  },
);

export const checkInAttendee = command(checkInAttendeeInput, async (input) => {
  const event = getRequestEvent();
  requireSameOrigin(event);
  const actor = requireStaff(event.locals.user);
  const result = await service.checkInAttendee(getAuthDb(env), actor.id, input);
  await getStaffAttendeeProgress({ qrCodeId: input.qrCodeId }).refresh();
  return result;
});

export const removeStageAttendance = command(
  removeStageAttendanceInput,
  async (input) => {
    const event = getRequestEvent();
    requireSameOrigin(event);
    const actor = requireStaff(event.locals.user);
    return service.removeStageAttendance(getAuthDb(env), actor.id, input);
  },
);
