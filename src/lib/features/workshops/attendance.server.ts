import { error } from "@sveltejs/kit";
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { Db } from "#db";
import {
  attendees,
  checkpointLogs,
  checkpoints,
  users,
  workshopRegistrations,
  workshopTimeSlots,
  workshops,
} from "#db/tables.ts";
import { findSessionUser } from "../auth/service.server";
import { requirePermission } from "../auth/guards.server";
import { getAttendeeProgress } from "../checkpoints/progress.server";
import { findAttendeeByQrCode } from "../checkpoints/service.server";
import type {
  CheckInWorkshopInput,
  SetWorkshopAttendanceInput,
} from "./schemas";

async function authorized(db: Db, actorId: string) {
  return requirePermission(await findSessionUser(db, actorId), "workshopStaff");
}

async function getRound(db: Db, slotId: string) {
  const [round] = await db
    .select({
      slot: workshopTimeSlots,
      workshop: workshops,
      checkpoint: checkpoints,
    })
    .from(workshopTimeSlots)
    .innerJoin(workshops, eq(workshops.id, workshopTimeSlots.workshopId))
    .innerJoin(
      checkpoints,
      and(
        eq(checkpoints.workshopTimeSlotId, workshopTimeSlots.id),
        eq(checkpoints.type, "workshop"),
        isNull(checkpoints.deletedAt),
      ),
    )
    .where(
      and(
        eq(workshopTimeSlots.id, slotId),
        isNull(workshopTimeSlots.deletedAt),
        isNull(workshops.deletedAt),
      ),
    )
    .limit(1);
  if (!round) error(404, "WORKSHOP_TIME_SLOT_NOT_FOUND");
  return round;
}

type Round = Awaited<ReturnType<typeof getRound>>;

async function attendeeById(db: Db, id: string) {
  const [attendee] = await db
    .select({
      id: attendees.id,
      firstname: attendees.firstname,
      lastname: attendees.lastname,
    })
    .from(attendees)
    .innerJoin(users, eq(users.id, attendees.userId))
    .where(
      and(
        eq(attendees.id, id),
        isNull(attendees.deletedAt),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  if (!attendee) error(404, "ATTENDEE_NOT_FOUND");
  return attendee;
}

type Attendee = Awaited<ReturnType<typeof attendeeById>>;

async function addAttendance(
  db: Db,
  checkerId: string,
  attendee: Attendee,
  round: Round,
  mode: "advance" | "open",
) {
  const hasBooking = sql`exists (select 1 from ${workshopRegistrations}
    where ${workshopRegistrations.attendeeId} = ${attendees.id}
      and ${workshopRegistrations.workshopTimeSlotId} = ${workshopTimeSlots.id}
      and ${workshopRegistrations.type} = 'advance' and ${workshopRegistrations.deletedAt} is null)`;
  const candidate = db
    .select({
      attendeeId: sql<string>`${attendees.id}`.as("attendee_id"),
      checkpointId: sql<string>`${checkpoints.id}`.as("checkpoint_id"),
      workshopId: sql<string>`${workshops.id}`.as("workshop_id"),
      attendanceType: sql<
        "advance" | "walk-in"
      >`case when ${hasBooking} then 'advance' else 'walk-in' end`.as(
        "attendance_type",
      ),
      rejection: sql<string | null>`case
      when not exists (
        select 1 from checkpoint_logs as entry_log inner join checkpoints as entry_point on entry_point.id = entry_log.checkpoint_id
        where entry_log.attendee_id = ${attendees.id} and entry_log.deleted_at is null and entry_point.deleted_at is null and entry_point.type = 'entry'
      ) then 'ENTRY_REQUIRED'
      when exists (select 1 from ${checkpointLogs} where ${checkpointLogs.attendeeId} = ${attendees.id}
        and ${checkpointLogs.checkpointId} = ${checkpoints.id} and ${checkpointLogs.deletedAt} is null) then 'ALREADY_CHECKED_IN'
      when exists (select 1 from ${checkpointLogs} where ${checkpointLogs.attendeeId} = ${attendees.id}
        and ${checkpointLogs.workshopId} = ${workshops.id} and ${checkpointLogs.deletedAt} is null) then 'WORKSHOP_ALREADY_ATTENDED'
      when ${mode} = 'advance' and not ${hasBooking} then 'ADVANCE_REGISTRATION_REQUIRED'
      when ${mode} = 'advance' and (
        select count(*) from ${checkpointLogs} where ${checkpointLogs.checkpointId} = ${checkpoints.id} and ${checkpointLogs.deletedAt} is null
      ) >= ${workshops.capacity} then 'WORKSHOP_FULL'
      else null end`.as("rejection"),
    })
    .from(attendees)
    .innerJoin(users, eq(users.id, attendees.userId))
    .innerJoin(workshopTimeSlots, eq(workshopTimeSlots.id, round.slot.id))
    .innerJoin(workshops, eq(workshops.id, workshopTimeSlots.workshopId))
    .innerJoin(
      checkpoints,
      and(
        eq(checkpoints.id, round.checkpoint.id),
        eq(checkpoints.workshopTimeSlotId, workshopTimeSlots.id),
        eq(checkpoints.type, "workshop"),
      ),
    )
    .where(
      and(
        eq(attendees.id, attendee.id),
        isNull(attendees.deletedAt),
        isNull(users.deletedAt),
        isNull(workshops.deletedAt),
        isNull(workshopTimeSlots.deletedAt),
        isNull(checkpoints.deletedAt),
      ),
    )
    .as("candidate");
  const now = Math.floor(Date.now() / 1000);
  const insert = db
    .insert(checkpointLogs)
    .select(
      db
        .select({
          id: sql<string>`${crypto.randomUUID()}`.as("id"),
          attendeeId: candidate.attendeeId,
          checkpointId: candidate.checkpointId,
          checkerId: sql<string>`${checkerId}`.as("checker_id"),
          workshopId: candidate.workshopId,
          attendanceType: candidate.attendanceType,
          removedById: sql<null>`null`.as("removed_by_id"),
          removalReason: sql<null>`null`.as("removal_reason"),
          createdAt: sql<Date>`${now}`.as("created_at"),
          updatedAt: sql<Date>`${now}`.as("updated_at"),
          deletedAt: sql<null>`null`.as("deleted_at"),
        })
        .from(candidate)
        .where(isNull(candidate.rejection)),
    )
    .returning();
  // No redemption predicate: workshops deliberately remain open after handover.
  const [rows, created] = await db.batch([db.select().from(candidate), insert]);
  if (!created[0]) error(409, rows[0]?.rejection ?? "CHECK_IN_CHANGED");
  return {
    attendee,
    checkpointId: round.checkpoint.id,
    log: created[0],
    alreadyCheckedIn: false,
    progress: await getAttendeeProgress(db, attendee.id),
  };
}

export async function checkInWorkshop(
  db: Db,
  actorId: string,
  input: CheckInWorkshopInput,
) {
  const actor = await authorized(db, actorId);
  const round = await getRound(db, input.workshopTimeSlotId);
  const attendee = await findAttendeeByQrCode(db, input.qrCodeId);
  return addAttendance(db, actor.staff.id, attendee, round, input.mode);
}

export async function setWorkshopAttendance(
  db: Db,
  actorId: string,
  input: SetWorkshopAttendanceInput,
) {
  const actor = await authorized(db, actorId);
  const round = await getRound(db, input.workshopTimeSlotId);
  const attendee = await attendeeById(db, input.attendeeId);
  if (input.present)
    return addAttendance(db, actor.staff.id, attendee, round, input.mode);
  const [log] = await db
    .update(checkpointLogs)
    .set({
      deletedAt: new Date(),
      removedById: actor.staff.id,
      removalReason: input.reason ?? "Removed by staff",
    })
    .where(
      and(
        eq(checkpointLogs.attendeeId, attendee.id),
        eq(checkpointLogs.checkpointId, round.checkpoint.id),
        isNull(checkpointLogs.deletedAt),
        sql`exists (select 1 from ${checkpoints}
        where ${checkpoints.id} = ${checkpointLogs.checkpointId} and ${checkpoints.type} = 'workshop'
          and ${checkpoints.workshopTimeSlotId} = ${round.slot.id} and ${checkpoints.deletedAt} is null)`,
      ),
    )
    .returning();
  if (!log) error(404, "ATTENDANCE_NOT_FOUND");
  return {
    removed: true,
    attendeeId: attendee.id,
    progress: await getAttendeeProgress(db, attendee.id),
  };
}

export async function listWorkshopAttendance(
  db: Db,
  actorId: string,
  input: { workshopTimeSlotId: string },
) {
  await authorized(db, actorId);
  const round = await getRound(db, input.workshopTimeSlotId);
  const [bookings, logs] = await db.batch([
    db
      .select({
        registrationId: sql<string>`${workshopRegistrations.id}`.as(
          "registration_id",
        ),
        attendeeId: sql<string>`${attendees.id}`.as("attendee_row_id"),
        firstname: attendees.firstname,
        lastname: attendees.lastname,
        registrationType: workshopRegistrations.type,
      })
      .from(workshopRegistrations)
      .innerJoin(attendees, eq(attendees.id, workshopRegistrations.attendeeId))
      .innerJoin(users, eq(users.id, attendees.userId))
      .where(
        and(
          eq(workshopRegistrations.workshopTimeSlotId, round.slot.id),
          isNull(workshopRegistrations.deletedAt),
          isNull(attendees.deletedAt),
          isNull(users.deletedAt),
        ),
      )
      .orderBy(asc(attendees.lastname), asc(attendees.id)),
    db
      .select({
        log: checkpointLogs,
        attendeeId: sql<string>`${attendees.id}`.as("attendee_row_id"),
        firstname: attendees.firstname,
        lastname: attendees.lastname,
      })
      .from(checkpointLogs)
      .innerJoin(attendees, eq(attendees.id, checkpointLogs.attendeeId))
      .innerJoin(users, eq(users.id, attendees.userId))
      .where(
        and(
          eq(checkpointLogs.checkpointId, round.checkpoint.id),
          isNull(checkpointLogs.deletedAt),
          isNull(attendees.deletedAt),
          isNull(users.deletedAt),
        ),
      )
      .orderBy(asc(attendees.lastname), asc(attendees.id)),
  ]);
  type Row = {
    attendee: Attendee;
    registrationId: string | null;
    registrationType: "advance" | "walk-in" | null;
    present: boolean;
    pending: boolean;
    log: (typeof logs)[number]["log"] | null;
  };
  const roster = new Map<string, Row>();
  for (const booking of bookings)
    roster.set(booking.attendeeId, {
      attendee: {
        id: booking.attendeeId,
        firstname: booking.firstname,
        lastname: booking.lastname,
      },
      registrationId: booking.registrationId,
      registrationType: booking.registrationType,
      present: false,
      pending: booking.registrationType === "advance",
      log: null,
    });
  for (const attendance of logs) {
    const row = roster.get(attendance.attendeeId) ?? {
      attendee: {
        id: attendance.attendeeId,
        firstname: attendance.firstname,
        lastname: attendance.lastname,
      },
      registrationId: null,
      registrationType: null,
      present: false,
      pending: false,
      log: null,
    };
    row.present = true;
    row.pending = false;
    row.log = attendance.log;
    roster.set(attendance.attendeeId, row);
  }
  return {
    slot: {
      id: round.slot.id,
      roundNumber: round.slot.roundNumber,
      capacity: round.workshop.capacity,
      startsAt: round.slot.startsAt,
      endsAt: round.slot.endsAt,
    },
    roster: [...roster.values()],
  };
}

export async function getWorkshopAttendanceStats(
  db: Db,
  actorId: string,
  input: { workshopTimeSlotId: string },
) {
  await authorized(db, actorId);
  const round = await getRound(db, input.workshopTimeSlotId);
  const roundLogs = (kind?: "advance" | "walk-in") =>
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(checkpointLogs)
      .where(
        and(
          eq(checkpointLogs.checkpointId, round.checkpoint.id),
          kind ? eq(checkpointLogs.attendanceType, kind) : undefined,
          isNull(checkpointLogs.deletedAt),
        ),
      );
  const bookings = (pendingOnly: boolean) =>
    db
      .select({
        count:
          sql<number>`count(distinct ${workshopRegistrations.attendeeId})`.mapWith(
            Number,
          ),
      })
      .from(workshopRegistrations)
      .innerJoin(attendees, eq(attendees.id, workshopRegistrations.attendeeId))
      .innerJoin(users, eq(users.id, attendees.userId))
      .where(
        and(
          eq(workshopRegistrations.workshopTimeSlotId, round.slot.id),
          eq(workshopRegistrations.type, "advance"),
          isNull(workshopRegistrations.deletedAt),
          isNull(attendees.deletedAt),
          isNull(users.deletedAt),
          pendingOnly
            ? sql`not exists (select 1 from ${checkpointLogs} where ${checkpointLogs.attendeeId} = ${workshopRegistrations.attendeeId}
        and ${checkpointLogs.checkpointId} = ${round.checkpoint.id} and ${checkpointLogs.deletedAt} is null)`
            : undefined,
        ),
      );
  const [booked, pending, advance, walkIn, total, workshopTotal, eventTotal] =
    await db.batch([
      bookings(false),
      bookings(true),
      roundLogs("advance"),
      roundLogs("walk-in"),
      roundLogs(),
      db
        .select({
          attendance: sql<number>`count(*)`.mapWith(Number),
          uniqueAttendees:
            sql<number>`count(distinct ${checkpointLogs.attendeeId})`.mapWith(
              Number,
            ),
        })
        .from(checkpointLogs)
        .where(
          and(
            eq(checkpointLogs.workshopId, round.workshop.id),
            isNull(checkpointLogs.deletedAt),
          ),
        ),
      db
        .select({
          attendance: sql<number>`count(*)`.mapWith(Number),
          uniqueAttendees:
            sql<number>`count(distinct ${checkpointLogs.attendeeId})`.mapWith(
              Number,
            ),
        })
        .from(checkpointLogs)
        .where(
          and(
            isNotNull(checkpointLogs.workshopId),
            isNull(checkpointLogs.deletedAt),
          ),
        ),
    ]);
  return {
    capacity: round.workshop.capacity,
    advanceBookings: booked[0].count,
    advanceArrivals: advance[0].count,
    pendingAdvanceArrivals: pending[0].count,
    walkInArrivals: walkIn[0].count,
    totalAttendance: total[0].count,
    overCapacity: Math.max(0, total[0].count - round.workshop.capacity),
    workshopTotals: workshopTotal[0],
    eventTotals: eventTotal[0],
  };
}
