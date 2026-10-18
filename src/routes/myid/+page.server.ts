import { error, redirect } from "@sveltejs/kit";
import {
  getActiveAttendeeByUserId,
  getAttendeeProfile,
} from "#lib/features/attendees/service.server.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(303, "/#register");

  const active = await getActiveAttendeeByUserId(locals.user.id);
  if (active.isErr()) {
    if (active.error === "ATTENDEE_NOT_FOUND") redirect(303, "/register");
    error(503, "ไม่สามารถโหลดข้อมูลลงทะเบียนได้ กรุณาลองอีกครั้ง");
  }

  const result = await getAttendeeProfile({ id: active.value.id });
  if (
    result.isErr() ||
    !result.value ||
    result.value.deletedAt ||
    result.value.userId !== locals.user.id
  ) {
    error(503, "ไม่สามารถโหลดข้อมูลลงทะเบียนได้ กรุณาลองอีกครั้ง");
  }

  return {
    profile: {
      name: `${result.value.firstname} ${result.value.lastname}`,
      code: result.value.qrCodeId,
    },
  };
};
