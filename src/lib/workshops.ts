import { workshopCatalog } from "#lib/data/workshops.ts";

export type WorkshopSession = {
  /** `<workshop slug>:<round>` (see sessionId). */
  id: string;
  /** The workshop's slug. */
  workshop: string;
  /** Round number within the workshop (what the booking API takes). */
  round: number;
  /** ISO 8601 in Bangkok time, e.g. 2026-10-31T13:00:00+07:00 */
  start: string;
  end: string;
  /** Active registrations, or null when unknown (the workshops API doesn't report it yet). */
  registered: number | null;
  capacity: number;
};

/** A session the attendee is booked into (from getWorkshopRegistrationsByAttendeeId). */
export type BookedSession = Pick<
  WorkshopSession,
  "id" | "workshop" | "round" | "start" | "end"
>;

export const sessionId = (workshop: string, round: number) =>
  `${workshop}:${round}`;

/** A Date as ISO 8601 in Bangkok time (UTC+7, no DST), so its first 10 chars are the local day. */
export function toBangkokIso(date: Date) {
  const local = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return `${local.toISOString().slice(0, 19)}+07:00`;
}

export type Workshop = {
  id: string;
  title: string;
  hostDepartment: string;
  /** As written on the schedule, e.g. "FOODTECH"; shown on the cards. */
  hostDepartmentAbbr: string;
  /** Not on the schedule yet; empty hides it. */
  description: string;
  capacity: number;
  sessions: WorkshopSession[];
};

/** `other-round`: booked into another round of the same workshop (one round per workshop). */
export type SessionStatus =
  "available" | "full" | "conflict" | "registered" | "other-round";

/** Status of `session` for an attendee already booked into `booked` (sessions of any workshop). */
export function sessionStatus(
  session: WorkshopSession,
  booked: BookedSession[],
): SessionStatus {
  if (booked.some((other) => other.id === session.id)) return "registered";
  if (session.registered !== null && session.registered >= session.capacity)
    return "full";
  // Another round of this workshop is replaced when changing rounds, so it can't clash.
  const start = Date.parse(session.start);
  const end = Date.parse(session.end);
  const overlaps = booked.some(
    (other) =>
      other.workshop !== session.workshop &&
      Date.parse(other.start) < end &&
      start < Date.parse(other.end),
  );
  if (overlaps) return "conflict";
  return booked.some((other) => other.workshop === session.workshop)
    ? "other-round"
    : "available";
}

/** Sessions grouped by Bangkok calendar day (YYYY-MM-DD), in order. */
export function sessionsByDay(sessions: WorkshopSession[]) {
  const days = new Map<string, WorkshopSession[]>();
  for (const session of sessions) {
    const day = session.start.slice(0, 10);
    days.set(day, [...(days.get(day) ?? []), session]);
  }
  return [...days].map(([day, sessions]) => ({ day, sessions }));
}

// The catalog (#lib/data/workshops.ts) is the single source: the D1 seed script reads it too.
// The list page shows it as is; pages with seat counts and bookings read D1 (toWorkshop).
export const workshops: Workshop[] = workshopCatalog.map((workshop) => ({
  id: workshop.slug,
  title: workshop.title,
  hostDepartment: workshop.hostDepartment,
  hostDepartmentAbbr: workshop.hostDepartmentAbbr,
  description: workshop.description,
  capacity: workshop.capacity,
  sessions: workshop.sessions.map((session, index) => ({
    ...session,
    id: sessionId(workshop.slug, index + 1),
    workshop: workshop.slug,
    round: index + 1,
    registered: null,
    capacity: workshop.capacity,
  })),
}));

/** A workshop as the workshops service's getWorkshop returns it. */
export type ApiWorkshop = {
  slug: string;
  title: string;
  hostDepartment: string;
  hostDepartimentAbbr: string;
  description: string;
  capacity: number;
  timeSlots: { roundNumber: number; startsAt: Date; endsAt: Date }[];
};

export const toWorkshop = (workshop: ApiWorkshop): Workshop => ({
  id: workshop.slug,
  title: workshop.title,
  hostDepartment: workshop.hostDepartment,
  hostDepartmentAbbr: workshop.hostDepartimentAbbr,
  description: workshop.description,
  capacity: workshop.capacity,
  sessions: workshop.timeSlots.map((slot) => ({
    id: sessionId(workshop.slug, slot.roundNumber),
    workshop: workshop.slug,
    round: slot.roundNumber,
    start: toBangkokIso(slot.startsAt),
    end: toBangkokIso(slot.endsAt),
    // Not reported by the API yet; a full round shows up when booking it (WORKSHOP_FULL).
    registered: null,
    capacity: workshop.capacity,
  })),
});

/** A registration as getWorkshopRegistrationsByAttendeeId returns it. */
export const toBookedSession = (registration: {
  workshopSlug: string;
  workshopRoundNumber: number;
  startsAt: Date;
  endsAt: Date;
}): BookedSession => ({
  id: sessionId(registration.workshopSlug, registration.workshopRoundNumber),
  workshop: registration.workshopSlug,
  round: registration.workshopRoundNumber,
  start: toBangkokIso(registration.startsAt),
  end: toBangkokIso(registration.endsAt),
});
