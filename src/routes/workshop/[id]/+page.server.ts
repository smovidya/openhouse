import { error } from "@sveltejs/kit";
import { getActiveAttendeeByUserId } from "#lib/features/attendees/service.server.ts";
import {
  getWorkshop,
  getWorkshopRegistrationsByAttendeeId,
} from "#lib/features/workshops/service.server.ts";
import {
  toBookedSession,
  toWorkshop,
  type BookedSession,
} from "#lib/workshops.ts";
import type { PageServerLoad } from "./$types";

// Explicit `never` so TypeScript narrows the Results after calls to it.
function unavailable(): never {
  error(503, "ไม่สามารถโหลดข้อมูลเวิร์กช็อปได้ กรุณาลองอีกครั้ง");
}

export const load: PageServerLoad = async ({ params, locals }) => {
  const result = await getWorkshop({ slug: params.id });
  if (result.isErr()) unavailable();
  if (!result.value) error(404, "ไม่พบเวิร์คช็อป");

  // Who is looking: bookings need a registered attendee.
  let attendee: "signed-out" | "unregistered" | "registered" = "signed-out";
  // Their sessions across all workshops, for registered/clash/other-round states.
  let booked: BookedSession[] = [];
  if (locals.user) {
    const active = await getActiveAttendeeByUserId(locals.user.id);
    if (active.isOk()) {
      const registrations = await getWorkshopRegistrationsByAttendeeId(
        active.value.id,
      );
      if (registrations.isErr()) unavailable();
      attendee = "registered";
      booked = registrations.value.map(toBookedSession);
    } else if (active.error === "ATTENDEE_NOT_FOUND") {
      attendee = "unregistered";
    } else {
      unavailable();
    }
  }

  return {
    waterOverlay: 0.5,
    workshop: toWorkshop(result.value),
    attendee,
    booked,
  };
};
