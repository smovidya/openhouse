import { dev } from "$app/env";
import { error, redirect } from "@sveltejs/kit";
import { getActiveAttendeeByUserId } from "#lib/features/attendees/service.server.ts";
import {
  getEvaluationResponse,
  hasAttendeeEntered,
} from "#lib/features/surveys/service.server.ts";
import { getRequestTimeGates } from "#lib/features/time/time.server.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, cookies }) => {
  if (!locals.user) redirect(303, "/#register");
  // Staff and attendees are mutually exclusive.
  if (locals.user.staff) redirect(303, "/staff");

  const active = await getActiveAttendeeByUserId(locals.user.id);
  if (active.isErr()) {
    if (active.error === "ATTENDEE_NOT_FOUND") redirect(303, "/register");
    error(503, "ไม่สามารถโหลดข้อมูลลงทะเบียนได้ กรุณาลองอีกครั้ง");
  }

  const gates = getRequestTimeGates(cookies, dev);
  const opened =
    Date.parse(gates.now) >= Date.parse(gates.schedule.eventStartsAt);

  const attendeeId = active.value.id;
  const entered = opened
    ? (await hasAttendeeEntered(attendeeId)).unwrapOr(false)
    : false;
  const response = (await getEvaluationResponse(attendeeId)).unwrapOr(null);

  return {
    opened,
    entered,
    submitted: response !== null,
    response,
  };
};
