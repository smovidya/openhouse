import { getMyWorkshopRegistrations } from "#lib/features/workshops/workshops.remote.ts";
import { workshops } from "#lib/workshops.js";
import type { PageLoad } from "./$types";

// The static catalog (the D1 seed reads it too); seat counts and booking are on the detail page.
export const load: PageLoad = async ({ parent }) => {
  // Slugs of the workshops the attendee holds a round of: their cards read ลงทะเบียนแล้ว.
  let registered: string[] = [];
  const { session } = await parent();
  if (session?.user.attendee) {
    const registrations = await getMyWorkshopRegistrations();
    // Without them the list still works; every card just reads ลงทะเบียน.
    if (registrations.isOk()) {
      registered = registrations.value.map(
        (registration) => registration.workshopSlug,
      );
    }
  }
  return { waterOverlay: 0.5, workshops, registered };
};
