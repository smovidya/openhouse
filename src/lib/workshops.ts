import { workshopCatalog } from "#lib/data/workshops.ts";

export type WorkshopSession = {
  id: string;
  /** ISO 8601 with offset, e.g. 2026-10-31T13:00:00+07:00 */
  start: string;
  end: string;
  registered: number;
  capacity: number;
};

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

export type SessionStatus = "available" | "full" | "conflict" | "registered";

/** Status of `session` for an attendee already booked into `booked` (sessions of any workshop). */
export function sessionStatus(
  session: WorkshopSession,
  booked: WorkshopSession[],
): SessionStatus {
  if (booked.some((other) => other.id === session.id)) return "registered";
  if (session.registered >= session.capacity) return "full";
  const start = Date.parse(session.start);
  const end = Date.parse(session.end);
  const overlaps = booked.some(
    (other) => Date.parse(other.start) < end && start < Date.parse(other.end),
  );
  return overlaps ? "conflict" : "available";
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
// Session ids match the seeded workshop_time_slots ids (`workshop-<slug>-<round>`).
export const workshops: Workshop[] = workshopCatalog.map((workshop) => ({
  id: workshop.slug,
  title: workshop.title,
  hostDepartment: workshop.hostDepartment,
  hostDepartmentAbbr: workshop.hostDepartmentAbbr,
  description: workshop.description,
  capacity: workshop.capacity,
  sessions: workshop.sessions.map((session, index) => ({
    ...session,
    id: `workshop-${workshop.slug}-${index + 1}`,
    // TODO: live counts from workshop_registrations.
    registered: 0,
    capacity: workshop.capacity,
  })),
}));

/** Session ids the signed-in attendee booked. TODO: from workshop_registrations. */
export const placeholderBookedIds: string[] = [];
