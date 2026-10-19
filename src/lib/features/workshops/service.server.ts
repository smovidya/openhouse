// Implement workshop reads and registration here, receiving Db from #lib/server/db.
// Registration also needs a trusted actor and must enforce eligibility, capacity,
// and duplicate-registration rules atomically using operations supported by D1.

import { getDb, tables } from "#lib/server/db/index.ts";
import {
  MAX_ADVANCE_WORKSHOP_REGISTRATIONS,
  MIN_WORKSHOP_GAP_MINUTES,
} from "#lib/constants/workshops.ts";
import { env } from "cloudflare:workers";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { err, ok, ResultAsync } from "neverthrow";

/** Read all rounds and their active counts in one query, including empty rounds. */
const readWorkshops = (slug?: string) => {
  const db = getDb(env.DB);
  const { workshops, workshopTimeSlots, workshopRegistrations } = tables;
  return db
    .select({
      slug: workshops.slug,
      title: workshops.title,
      hostDepartment: workshops.hostDepartment,
      hostDepartimentAbbr: workshops.hostDepartimentAbbr,
      description: workshops.description,
      capacity: workshops.capacity,
      slotId: workshopTimeSlots.id,
      roundNumber: workshopTimeSlots.roundNumber,
      startsAt: workshopTimeSlots.startsAt,
      endsAt: workshopTimeSlots.endsAt,
      registeredCount: sql<number>`(
      SELECT count(*) FROM ${workshopRegistrations}
      WHERE ${workshopRegistrations.workshopTimeSlotId} = ${workshopTimeSlots.id}
        AND ${workshopRegistrations.deletedAt} IS NULL
    )`.mapWith(Number),
    })
    .from(workshops)
    .leftJoin(
      workshopTimeSlots,
      and(
        eq(workshopTimeSlots.workshopId, workshops.id),
        isNull(workshopTimeSlots.deletedAt),
      ),
    )
    .where(
      and(
        isNull(workshops.deletedAt),
        slug === undefined ? undefined : eq(workshops.slug, slug),
      ),
    )
    .orderBy(asc(workshops.slug), asc(workshopTimeSlots.roundNumber));
};

type WorkshopRow = Awaited<ReturnType<typeof readWorkshops>>[number];
function groupWorkshops(rows: WorkshopRow[]) {
  type Round = {
    roundNumber: number;
    startsAt: Date;
    endsAt: Date;
    registeredCount: number;
  };
  const grouped = new Map<
    string,
    Omit<
      WorkshopRow,
      "slotId" | "roundNumber" | "startsAt" | "endsAt" | "registeredCount"
    > & { timeSlots: Round[] }
  >();
  for (const {
    slotId,
    roundNumber,
    startsAt,
    endsAt,
    registeredCount,
    ...workshop
  } of rows) {
    let entry = grouped.get(workshop.slug);
    if (!entry) {
      entry = { ...workshop, timeSlots: [] };
      grouped.set(workshop.slug, entry);
    }
    if (slotId && roundNumber !== null && startsAt && endsAt) {
      entry.timeSlots.push({ roundNumber, startsAt, endsAt, registeredCount });
    }
  }
  return [...grouped.values()];
}

export const listWorkshops = () =>
  ResultAsync.fromPromise(
    readWorkshops(),
    () => "FETCH_WORKSHOPS_FAILED" as const,
  ).map((rows) =>
    groupWorkshops(rows).map(({ timeSlots, ...workshop }) => ({
      ...workshop,
      timeslots: timeSlots,
    })),
  );

export const getWorkshop = (where: { slug: string }) =>
  ResultAsync.fromPromise(
    readWorkshops(where.slug),
    () => "FETCH_WORKSHOP_FAILED" as const,
  ).map((rows) => groupWorkshops(rows)[0]);

export const getWorkshopRegistrationsByAttendeeId = (attendeeId: string) => {
  const db = getDb(env.DB);
  const { workshops, workshopTimeSlots, workshopRegistrations } = tables;
  return ResultAsync.fromPromise(
    db
      .select({
        id: workshopRegistrations.id,
        type: workshopRegistrations.type,
        createdAt: workshopRegistrations.createdAt,
        workshopSlug: workshops.slug,
        workshopTitle: workshops.title,
        department: workshops.hostDepartment,
        departmentAbbr: workshops.hostDepartimentAbbr,
        description: workshops.description,
        workshopRoundNumber: workshopTimeSlots.roundNumber,
        startsAt: workshopTimeSlots.startsAt,
        endsAt: workshopTimeSlots.endsAt,
      })
      .from(workshopRegistrations)
      .innerJoin(
        workshopTimeSlots,
        eq(workshopRegistrations.workshopTimeSlotId, workshopTimeSlots.id),
      )
      .innerJoin(workshops, eq(workshopTimeSlots.workshopId, workshops.id))
      .where(
        and(
          eq(workshopRegistrations.attendeeId, attendeeId),
          isNull(workshopRegistrations.deletedAt),
        ),
      )
      .orderBy(asc(workshopTimeSlots.startsAt)),
    () => "FETCH_WORKSHOP_REGISTRATIONS_FAILED" as const,
  );
};

export const getWorkshopTimeSlots = (where: {
  workshopSlug: string;
  roundNumber?: number;
}) => {
  const db = getDb(env.DB);
  return ResultAsync.fromPromise(
    db
      .select({
        workshopId: tables.workshops.id,
        roundNumber: tables.workshopTimeSlots.roundNumber,
        startsAt: tables.workshopTimeSlots.startsAt,
        endsAt: tables.workshopTimeSlots.endsAt,
      })
      .from(tables.workshopTimeSlots)
      .innerJoin(
        tables.workshops,
        eq(tables.workshopTimeSlots.workshopId, tables.workshops.id),
      )
      .where(
        and(
          eq(tables.workshops.slug, where.workshopSlug),
          where.roundNumber !== undefined
            ? eq(tables.workshopTimeSlots.roundNumber, where.roundNumber)
            : undefined,
        ),
      )
      .orderBy(asc(tables.workshopTimeSlots.roundNumber)),
    () => "FETCH_WORKSHOP_TIMESLOTS_FAILED" as const,
  );
};

export type WorkshopRegistrationError =
  | "ATTENDEE_NOT_FOUND"
  | "WORKSHOP_TIME_SLOT_NOT_FOUND"
  | "ALREADY_REGISTERED_FOR_WORKSHOP"
  | "ALREADY_REGISTERED_FOR_DEPARTMENT"
  | "WORKSHOP_TIME_CONFLICT"
  | "WORKSHOP_ADVANCE_REGISTRATION_LIMIT_REACHED"
  | "WORKSHOP_FULL"
  | "WORKSHOP_ALREADY_STARTED"
  | "REGISTER_FOR_WORKSHOP_FAILED";

/**
 * Registers a trusted attendee ID. Capacity is per round, shared by both types.
 * An attendee may attend a department once, with a 60-minute gap between rounds.
 */
export const registerForWorkshop = (input: {
  attendeeId: string;
  workshopSlug: string;
  workshopRoundNumber: number;
  type: "advance" | "walk-in";
  now?: Date;
}) => {
  const db = getDb(env.DB);
  const {
    workshops,
    workshopTimeSlots,
    workshopRegistrations,
    attendees,
    users,
  } = tables;
  const now = input.now ?? new Date();
  const nowTimestamp = Math.floor(now.getTime() / 1000);
  const candidate = db
    .select({
      timeSlotId: workshopTimeSlots.id,
      rejection: sql<WorkshopRegistrationError | null>`CASE
        WHEN NOT EXISTS (
          SELECT 1 FROM ${attendees}
          INNER JOIN ${users} ON ${users.id} = ${attendees.userId}
          WHERE ${attendees.id} = ${input.attendeeId}
            AND ${attendees.deletedAt} IS NULL
            AND ${users.deletedAt} IS NULL
        ) THEN 'ATTENDEE_NOT_FOUND'
        WHEN ${input.type} = 'advance'
          AND ${workshopTimeSlots.startsAt} <= ${nowTimestamp}
          THEN 'WORKSHOP_ALREADY_STARTED'
        WHEN EXISTS (
          SELECT 1 FROM ${workshopRegistrations} AS registration
          INNER JOIN ${workshopTimeSlots} AS registered_slot
            ON registered_slot.id = registration.workshop_time_slot_id
          WHERE registration.attendee_id = ${input.attendeeId}
            AND registration.deleted_at IS NULL
            AND registered_slot.workshop_id = ${workshops.id}
        ) THEN 'ALREADY_REGISTERED_FOR_WORKSHOP'
        WHEN EXISTS (
          SELECT 1 FROM ${workshopRegistrations} AS registration
          INNER JOIN ${workshopTimeSlots} AS registered_slot
            ON registered_slot.id = registration.workshop_time_slot_id
          INNER JOIN ${workshops} AS registered_workshop
            ON registered_workshop.id = registered_slot.workshop_id
          WHERE registration.attendee_id = ${input.attendeeId}
            AND registration.deleted_at IS NULL
            AND registered_workshop.host_department_abbr = ${workshops.hostDepartimentAbbr}
        ) THEN 'ALREADY_REGISTERED_FOR_DEPARTMENT'
        WHEN EXISTS (
          SELECT 1 FROM ${workshopRegistrations} AS registration
          INNER JOIN ${workshopTimeSlots} AS registered_slot
            ON registered_slot.id = registration.workshop_time_slot_id
          WHERE registration.attendee_id = ${input.attendeeId}
            AND registration.deleted_at IS NULL
            AND registered_slot.starts_at < ${workshopTimeSlots.endsAt} + ${MIN_WORKSHOP_GAP_MINUTES * 60}
            AND registered_slot.ends_at + ${MIN_WORKSHOP_GAP_MINUTES * 60} > ${workshopTimeSlots.startsAt}
        ) THEN 'WORKSHOP_TIME_CONFLICT'
        WHEN ${input.type} = 'advance' AND (
          SELECT count(*) FROM ${workshopRegistrations}
          WHERE ${workshopRegistrations.attendeeId} = ${input.attendeeId}
            AND ${workshopRegistrations.type} = 'advance'
            AND ${workshopRegistrations.deletedAt} IS NULL
        ) >= ${MAX_ADVANCE_WORKSHOP_REGISTRATIONS}
          THEN 'WORKSHOP_ADVANCE_REGISTRATION_LIMIT_REACHED'
        WHEN (
          SELECT count(*) FROM ${workshopRegistrations}
          WHERE ${workshopRegistrations.workshopTimeSlotId} = ${workshopTimeSlots.id}
            AND ${workshopRegistrations.deletedAt} IS NULL
        ) >= ${workshops.capacity} THEN 'WORKSHOP_FULL'
        ELSE NULL
      END`.as("rejection"),
    })
    .from(workshopTimeSlots)
    .innerJoin(workshops, eq(workshopTimeSlots.workshopId, workshops.id))
    .where(
      and(
        eq(workshops.slug, input.workshopSlug),
        eq(workshopTimeSlots.roundNumber, input.workshopRoundNumber),
        isNull(workshops.deletedAt),
        isNull(workshopTimeSlots.deletedAt),
      ),
    )
    .limit(1)
    .as("candidate");

  const registration = db
    .insert(workshopRegistrations)
    .select(
      db
        .select({
          id: sql<string>`${crypto.randomUUID()}`.as("id"),
          workshopTimeSlotId: candidate.timeSlotId,
          attendeeId: sql<string>`${input.attendeeId}`.as("attendee_id"),
          type: sql<"advance" | "walk-in">`${input.type}`.as("type"),
          createdAt: sql<Date>`${nowTimestamp}`.as("created_at"),
          updatedAt: sql<Date>`${nowTimestamp}`.as("updated_at"),
          deletedAt: sql<Date | null>`NULL`.as("deleted_at"),
        })
        .from(candidate)
        .where(isNull(candidate.rejection)),
    )
    .returning();

  // The INSERT itself checks eligibility. Keep the rejection read in the same
  // D1 transaction so another request cannot change the reason between queries.
  // Do not replace this with separate awaited reads and writes or db.transaction.
  return ResultAsync.fromPromise(
    db.batch([db.select().from(candidate), registration]),
    (): WorkshopRegistrationError => "REGISTER_FOR_WORKSHOP_FAILED",
  ).andThen(([candidates, registrations]) => {
    const created = registrations[0];
    if (created) return ok(created);
    return err<never, WorkshopRegistrationError>(
      candidates[0]?.rejection ??
        (candidates.length === 0
          ? "WORKSHOP_TIME_SLOT_NOT_FOUND"
          : "REGISTER_FOR_WORKSHOP_FAILED"),
    );
  });
};

export type WorkshopUnregistrationError =
  "WORKSHOP_REGISTRATION_NOT_FOUND" | "UNREGISTER_FROM_WORKSHOP_FAILED";

/** Soft-deletes the attendee's active registration for one workshop round. */
export const unregisterFromWorkshop = (input: {
  attendeeId: string;
  workshopSlug: string;
  workshopRoundNumber: number;
}) => {
  const db = getDb(env.DB);
  const { workshops, workshopTimeSlots, workshopRegistrations } = tables;
  const matchingTimeSlots = db
    .select({ id: workshopTimeSlots.id })
    .from(workshopTimeSlots)
    .innerJoin(workshops, eq(workshopTimeSlots.workshopId, workshops.id))
    .where(
      and(
        eq(workshops.slug, input.workshopSlug),
        eq(workshopTimeSlots.roundNumber, input.workshopRoundNumber),
      ),
    );

  return ResultAsync.fromPromise(
    db
      .update(workshopRegistrations)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(workshopRegistrations.attendeeId, input.attendeeId),
          isNull(workshopRegistrations.deletedAt),
          inArray(workshopRegistrations.workshopTimeSlotId, matchingTimeSlots),
        ),
      )
      .returning(),
    (): WorkshopUnregistrationError => "UNREGISTER_FROM_WORKSHOP_FAILED",
  ).andThen(([registration]) =>
    registration
      ? ok(registration)
      : err<never, WorkshopUnregistrationError>(
          "WORKSHOP_REGISTRATION_NOT_FOUND",
        ),
  );
};
