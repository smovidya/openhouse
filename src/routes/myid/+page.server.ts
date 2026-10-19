import { dev } from "$app/env";
import { error, redirect } from "@sveltejs/kit";
import {
  getActiveAttendeeByUserId,
  getAttendeeProfile,
} from "#lib/features/attendees/service.server.ts";
import type { RegisteredWorkshop } from "#lib/components/workshop-card.svelte";
import { MAX_ADVANCE_WORKSHOP_REGISTRATIONS } from "#lib/constants/workshops.ts";
import { workshopCatalog } from "#lib/data/workshops.ts";
import { getWorkshopRegistrationsByAttendeeId } from "#lib/features/workshops/service.server.ts";
import { getRequestTimeGates } from "#lib/features/time/time.server.ts";
import { toBangkokIso } from "#lib/workshops.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, cookies }) => {
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

  const registrations = await getWorkshopRegistrationsByAttendeeId(
    active.value.id,
  );
  if (registrations.isErr()) {
    error(503, "ไม่สามารถโหลดเวิร์กช็อปที่ลงทะเบียนได้ กรุณาลองอีกครั้ง");
  }
  // Department and description are catalog content, not stored per registration.
  const workshops = registrations.value.map(
    (registration): RegisteredWorkshop => {
      const info = workshopCatalog.find(
        (w) => w.slug === registration.workshopSlug,
      );
      return {
        id: registration.id,
        slug: registration.workshopSlug,
        type: registration.type,
        title: registration.workshopTitle,
        department: info?.hostDepartmentAbbr ?? "",
        description: info?.description ?? "",
        start: toBangkokIso(registration.startsAt),
        end: toBangkokIso(registration.endsAt),
      };
    },
  );

  return {
    profile: {
      name: `${result.value.firstname} ${result.value.lastname}`,
      code: result.value.qrCodeId,
    },
    workshops,
    // The limit is on advance registrations; walk-ins (on the day) don't count toward it.
    advanceCount: registrations.value.filter(
      (registration) => registration.type === "advance",
    ).length,
    workshopLimit: MAX_ADVANCE_WORKSHOP_REGISTRATIONS,
    // Before it opens, My Workshops shows a "Coming Soon" card; after it closes, no "ลงทะเบียนเพิ่ม".
    // The server clock (or the dev toolbar's frozen one).
    ...(() => {
      const gates = getRequestTimeGates(cookies, dev);
      const now = Date.parse(gates.now);
      return {
        workshopRegistrationOpened:
          now >= Date.parse(gates.schedule.workshopRegistrationOpensAt),
        workshopRegistrationClosed:
          now >= Date.parse(gates.schedule.workshopRegistrationClosesAt),
      };
    })(),
  };
};
