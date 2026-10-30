// MOCK of workshop attendance, the API in development on ptsgrn/activities-completments
// (src/lib/features/workshops/attendance.remote.ts there). Same function names, inputs, results
// and 409 rejection codes, so the real calls are an import swap once it's merged. Differences:
// - `workshopTimeSlotId` here is a catalog session id (`<slug>:<round>`, see sessionId), not a
//   D1 row id.
// - checkInWorkshop also takes the looked-up attendee: the real one resolves `qrCodeId` itself.
// - ENTRY_REQUIRED never happens: nothing here knows whether the attendee passed the entry point.
// State lives in this module, so it resets on reload. The dev fixture attendee (dev-attendee-qr)
// is booked into every round; anyone else scanned is a walk-in.
// TODO(backend): replace with #lib/features/workshops/attendance.remote.ts.
import { error } from "@sveltejs/kit";
import type { RejectionCode } from "#lib/workshop-attendance.js";
import { workshops } from "#lib/workshops.js";

import type { AttendanceMode } from "#lib/workshop-attendance.js";
export type AttendanceType = "advance" | "walk-in";

export type RosterAttendee = {
  id: string;
  firstname: string;
  lastname: string;
};
export type RosterRow = {
  attendee: RosterAttendee;
  /** "advance" when booked ahead; null for walk-ins. */
  registrationType: "advance" | null;
  /** How they were let in; null while a booked attendee hasn't arrived. */
  attendance: AttendanceType | null;
};

const DEV_FIXTURE_QR = "dev-attendee-qr";

const seedNames: readonly (readonly [string, string])[] = [
  ["พัสกร", "ยืนยง"],
  ["วิทยา", "รักจุฬา"],
  ["ธนพร", "ใจดี"],
];

// Every catalog round up front: reads happen inside $derived, which must not write state.
const rosters = $state<Record<string, RosterRow[]>>(
  Object.fromEntries(
    workshops.flatMap((workshop) =>
      workshop.sessions.map((session) => [
        session.id,
        seedNames.map(([firstname, lastname], index): RosterRow => ({
          attendee: { id: `mock-${session.id}-${index}`, firstname, lastname },
          registrationType: "advance",
          attendance: index === 1 ? "advance" : null,
        })),
      ]),
    ),
  ),
);

function roster(slotId: string): RosterRow[] {
  const rows = rosters[slotId];
  if (!rows) error(404, "WORKSHOP_TIME_SLOT_NOT_FOUND");
  return rows;
}

function capacity(slotId: string) {
  const [slug] = slotId.split(":");
  return workshops.find((workshop) => workshop.id === slug)?.capacity ?? 0;
}

function reject(code: RejectionCode): never {
  error(409, code);
}

/** The real addAttendance's rules, in its order. */
function addAttendance(slotId: string, row: RosterRow, mode: AttendanceMode) {
  if (row.attendance) reject("ALREADY_CHECKED_IN");
  const [slug] = slotId.split(":");
  const attendedOtherRound = Object.entries(rosters).some(
    ([otherId, rows]) =>
      otherId !== slotId &&
      otherId.startsWith(`${slug}:`) &&
      rows.some(
        (other) => other.attendee.id === row.attendee.id && other.attendance,
      ),
  );
  if (attendedOtherRound) reject("WORKSHOP_ALREADY_ATTENDED");
  const booked = row.registrationType === "advance";
  if (mode === "advance" && !booked) reject("ADVANCE_REGISTRATION_REQUIRED");
  const present = roster(slotId).filter((other) => other.attendance).length;
  if (mode === "advance" && present >= capacity(slotId))
    reject("WORKSHOP_FULL");
  row.attendance = booked ? "advance" : "walk-in";
  return { attendanceType: row.attendance, alreadyCheckedIn: false as const };
}

export async function checkInWorkshop(
  input: { workshopTimeSlotId: string; qrCodeId: string; mode: AttendanceMode },
  attendee: RosterAttendee,
) {
  const rows = roster(input.workshopTimeSlotId);
  let row = rows.find((other) => other.attendee.id === attendee.id);
  if (!row) {
    const booked = input.qrCodeId === DEV_FIXTURE_QR;
    rows.push({
      attendee: {
        id: attendee.id,
        firstname: attendee.firstname,
        lastname: attendee.lastname,
      },
      registrationType: booked ? "advance" : null,
      attendance: null,
    });
    row = rows[rows.length - 1];
  }
  try {
    return addAttendance(input.workshopTimeSlotId, row, input.mode);
  } finally {
    // A rejected walk-in leaves nothing behind, as the real insert-or-nothing does.
    if (!row.registrationType && !row.attendance)
      rows.splice(rows.indexOf(row), 1);
  }
}

/** The list's switch (booked attendees) and ลบออก (walk-ins: `present: false`). */
export async function setWorkshopAttendance(input: {
  workshopTimeSlotId: string;
  attendeeId: string;
  present: boolean;
  mode: AttendanceMode;
}) {
  const rows = roster(input.workshopTimeSlotId);
  const row = rows.find((other) => other.attendee.id === input.attendeeId);
  if (!row) error(404, "ATTENDEE_NOT_FOUND");
  if (input.present)
    return addAttendance(input.workshopTimeSlotId, row, input.mode);
  if (!row.attendance) error(404, "ATTENDANCE_NOT_FOUND");
  row.attendance = null;
  if (!row.registrationType) rows.splice(rows.indexOf(row), 1);
  return { removed: true as const, attendeeId: row.attendee.id };
}

/** Reactive: read it in a $derived to follow changes. */
export function listWorkshopAttendance(input: { workshopTimeSlotId: string }) {
  return { roster: roster(input.workshopTimeSlotId) };
}

/** Reactive, like listWorkshopAttendance. */
export function getWorkshopAttendanceStats(input: {
  workshopTimeSlotId: string;
}) {
  const rows = roster(input.workshopTimeSlotId);
  const count = (type: AttendanceType) =>
    rows.filter((row) => row.attendance === type).length;
  return {
    capacity: capacity(input.workshopTimeSlotId),
    advanceBookings: rows.filter((row) => row.registrationType === "advance")
      .length,
    advanceArrivals: count("advance"),
    walkInArrivals: count("walk-in"),
    totalAttendance: count("advance") + count("walk-in"),
  };
}
