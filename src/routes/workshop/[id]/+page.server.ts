import { dev } from "$app/env";
import { error } from "@sveltejs/kit";
import { MAX_ADVANCE_WORKSHOP_REGISTRATIONS } from "#lib/constants/workshops.ts";
import { getActiveAttendeeByUserId } from "#lib/features/attendees/service.server.ts";
import {
  getWorkshop,
  getWorkshopRegistrationsByAttendeeId,
} from "#lib/features/workshops/service.server.ts";
import { getRequestTimeGates } from "#lib/features/time/time.server.ts";
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

export const load: PageServerLoad = async ({ params, locals, cookies }) => {
  const result = await getWorkshop({ slug: params.id });
  if (result.isErr()) unavailable();
  if (!result.value) error(404, "ไม่พบเวิร์คช็อป");

  // Who is looking: bookings need a registered attendee.
  let attendee: "signed-out" | "unregistered" | "registered" = "signed-out";
  // Their sessions across all workshops, for registered/clash/other-round states.
  let booked: BookedSession[] = [];
  let advanceCount = 0;
  if (locals.user) {
    const active = await getActiveAttendeeByUserId(locals.user.id);
    if (active.isOk()) {
      const registrations = await getWorkshopRegistrationsByAttendeeId(
        active.value.id,
      );
      if (registrations.isErr()) unavailable();
      attendee = "registered";
      booked = registrations.value.map(toBookedSession);
      advanceCount = registrations.value.filter(
        (registration) => registration.type === "advance",
      ).length;
    } else if (active.error === "ATTENDEE_NOT_FOUND") {
      attendee = "unregistered";
    } else {
      unavailable();
    }
  }

  // The server's clock (the dev toolbar's frozen one in development), so rows show what booking
  // would actually allow: closed, already started, or over the advance limit (BookingWindow).
  const gates = getRequestTimeGates(cookies, dev);
  return {
    waterOverlay: 0.5,
    workshop: toWorkshop(result.value),
    attendee,
    booked,
    now: gates.now,
    registrationClosed:
      Date.parse(gates.now) >=
      Date.parse(gates.schedule.workshopRegistrationClosesAt),
    advanceLeft: Math.max(0, MAX_ADVANCE_WORKSHOP_REGISTRATIONS - advanceCount),
  };
};
