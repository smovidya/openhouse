import { error, redirect } from "@sveltejs/kit";
import { getActiveAttendeeByUserId } from "#lib/features/attendees/service.server.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(303, "/#register");
  const attendee = await getActiveAttendeeByUserId(locals.user.id);
  if (attendee.isOk()) redirect(303, "/myid");
  if (attendee.error !== "ATTENDEE_NOT_FOUND") {
    error(503, "ไม่สามารถตรวจสอบข้อมูลลงทะเบียนได้ กรุณาลองอีกครั้ง");
  }
  return {};
};
