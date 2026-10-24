import { command, getRequestEvent, query } from "$app/server";
import { env } from "cloudflare:workers";
import { getAuthDb } from "../auth/config.server";
import { requireSameOrigin, requireStaff } from "../auth/guards.server";
import {
  checkInWorkshopInput,
  setWorkshopAttendanceInput,
  workshopTimeSlotInput,
} from "./schemas";
import * as service from "./attendance.server";
function context(mutation = false) {
  const event = getRequestEvent();
  if (mutation) requireSameOrigin(event);
  return { db: getAuthDb(env), actorId: requireStaff(event.locals.user).id };
}
export const listWorkshopAttendance = query(workshopTimeSlotInput, (input) => {
  const c = context();
  return service.listWorkshopAttendance(c.db, c.actorId, input);
});
export const getWorkshopAttendanceStats = query(
  workshopTimeSlotInput,
  (input) => {
    const c = context();
    return service.getWorkshopAttendanceStats(c.db, c.actorId, input);
  },
);
async function refreshRound(workshopTimeSlotId: string) {
  await Promise.all([
    listWorkshopAttendance({ workshopTimeSlotId }).refresh(),
    getWorkshopAttendanceStats({ workshopTimeSlotId }).refresh(),
  ]);
}

export const checkInWorkshop = command(checkInWorkshopInput, async (input) => {
  const c = context(true);
  const result = await service.checkInWorkshop(c.db, c.actorId, input);
  await refreshRound(input.workshopTimeSlotId);
  return result;
});
export const setWorkshopAttendance = command(
  setWorkshopAttendanceInput,
  async (input) => {
    const c = context(true);
    const result = await service.setWorkshopAttendance(c.db, c.actorId, input);
    await refreshRound(input.workshopTimeSlotId);
    return result;
  },
);
