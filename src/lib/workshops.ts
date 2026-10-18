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
  department: string;
  description: string;
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

// Attendance counts and bookings remain placeholders until the pages use the backend.
export const placeholderWorkshops: Workshop[] = workshopCatalog.map(
  (workshop) => ({
    id: workshop.slug,
    title: workshop.title,
    department: `${workshop.hostDepartment} (${workshop.hostDepartmentAbbr})`,
    description: workshop.description,
    sessions: workshop.sessions.map((session, index) => ({
      ...session,
      id: `${workshop.slug}-${index + 1}`,
      registered: 0,
      capacity: workshop.capacity,
    })),
  }),
);

export const placeholderBookedIds: string[] = [];
