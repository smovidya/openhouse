import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "#db";
import { BANGKOK_TIME_ZONE, EVENT_SCHEDULE } from "#lib/constants/time.ts";
import {
  attendees,
  checkpointLogs,
  checkpoints,
  workshopRegistrations,
  workshopTimeSlots,
  workshops,
} from "#db/tables.ts";
import type {
  BoothStats,
  DashboardFeedItem,
  DashboardStats,
  WorkshopRoundAttendee,
  WorkshopStats,
} from "./types";

export type {
  BoothStats,
  DashboardFeedItem,
  DashboardStats,
  WorkshopRoundAttendee,
  WorkshopRoundStats,
  WorkshopStats,
} from "./types";

/** Checkpoint types that count as event booths for the race view. */
const boothTypes = ["booth", "tcas", "central_activity"] as const;

/**
 * Event-day boundaries (Asia/Bangkok) for the two-day split.
 * Day 1 starts at the Bangkok midnight of the schedule's opening day,
 * day 2 at the next midnight. Returns unix-seconds bounds [day1Start, day2Start, day3Start].
 */
export function getEventDayBounds(): [number, number, number] {
  const startDate = new Date(EVENT_SCHEDULE.eventStartsAt);
  const startKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(startDate); // YYYY-MM-DD in Bangkok
  const day1Start = Math.floor(Date.parse(`${startKey}T00:00:00+07:00`) / 1000);
  const day2Start = day1Start + 86_400;
  const day3Start = day2Start + 86_400;
  return [day1Start, day2Start, day3Start];
}

export async function getDashboardStats(db: Db): Promise<DashboardStats> {
  const activeSince = Math.floor((Date.now() - 30 * 60 * 1000) / 1000);
  const [day1Start, day2Start, day3Start] = getEventDayBounds();

  const [
    [registeredRow],
    [attendedRow],
    [totalCheckinsRow],
    [activeNowRow],
    [attendedDay1Row],
    [attendedDay2Row],
    [checkinsDay1Row],
    [checkinsDay2Row],
    boothRows,
    hourlyRows,
    hourlyEntryRows,
    workshopRows,
  ] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(attendees)
      .where(isNull(attendees.deletedAt)),
    db
      .select({
        value:
          sql<number>`count(distinct ${checkpointLogs.attendeeId})`.mapWith(
            Number,
          ),
      })
      .from(checkpointLogs)
      .innerJoin(checkpoints, eq(checkpoints.id, checkpointLogs.checkpointId))
      .where(
        and(isNull(checkpointLogs.deletedAt), eq(checkpoints.type, "entry")),
      ),
    db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(checkpointLogs)
      .where(isNull(checkpointLogs.deletedAt)),
    db
      .select({
        value:
          sql<number>`count(distinct ${checkpointLogs.attendeeId})`.mapWith(
            Number,
          ),
      })
      .from(checkpointLogs)
      .where(
        and(
          isNull(checkpointLogs.deletedAt),
          sql`${checkpointLogs.createdAt} >= ${activeSince}`,
        ),
      ),
    // Day 1 distinct entrants (entry check-in within day 1).
    db
      .select({
        value:
          sql<number>`count(distinct ${checkpointLogs.attendeeId})`.mapWith(
            Number,
          ),
      })
      .from(checkpointLogs)
      .innerJoin(checkpoints, eq(checkpoints.id, checkpointLogs.checkpointId))
      .where(
        and(
          isNull(checkpointLogs.deletedAt),
          eq(checkpoints.type, "entry"),
          sql`${checkpointLogs.createdAt} >= ${day1Start}`,
          sql`${checkpointLogs.createdAt} < ${day2Start}`,
        ),
      ),
    // Day 2 distinct entrants.
    db
      .select({
        value:
          sql<number>`count(distinct ${checkpointLogs.attendeeId})`.mapWith(
            Number,
          ),
      })
      .from(checkpointLogs)
      .innerJoin(checkpoints, eq(checkpoints.id, checkpointLogs.checkpointId))
      .where(
        and(
          isNull(checkpointLogs.deletedAt),
          eq(checkpoints.type, "entry"),
          sql`${checkpointLogs.createdAt} >= ${day2Start}`,
          sql`${checkpointLogs.createdAt} < ${day3Start}`,
        ),
      ),
    // Total check-in logs on day 1.
    db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(checkpointLogs)
      .where(
        and(
          isNull(checkpointLogs.deletedAt),
          sql`${checkpointLogs.createdAt} >= ${day1Start}`,
          sql`${checkpointLogs.createdAt} < ${day2Start}`,
        ),
      ),
    // Total check-in logs on day 2.
    db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(checkpointLogs)
      .where(
        and(
          isNull(checkpointLogs.deletedAt),
          sql`${checkpointLogs.createdAt} >= ${day2Start}`,
          sql`${checkpointLogs.createdAt} < ${day3Start}`,
        ),
      ),
    db
      .select({
        id: checkpoints.id,
        name: checkpoints.name,
        department: checkpoints.department,
        type: sql<BoothStats["type"]>`cast(${checkpoints.type} as text)`,
        scans: sql<number>`(
          select count(*) from ${checkpointLogs}
          where ${checkpointLogs.checkpointId} = ${checkpoints.id}
            and ${checkpointLogs.deletedAt} is null
        )`.mapWith(Number),
      })
      .from(checkpoints)
      .where(
        and(
          isNull(checkpoints.deletedAt),
          inArray(checkpoints.type, [...boothTypes]),
        ),
      )
      .orderBy(asc(checkpoints.id)),
    db
      .select({
        // UTC ISO hour (trailing Z) so client code can parse it as UTC and
        // render it in the attendee's local zone (Asia/Bangkok).
        hour: sql<string>`strftime('%Y-%m-%dT%H:00Z', ${checkpointLogs.createdAt}, 'unixepoch')`,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(checkpointLogs)
      .where(isNull(checkpointLogs.deletedAt))
      .groupBy(
        sql`strftime('%Y-%m-%dT%H:00', ${checkpointLogs.createdAt}, 'unixepoch')`,
      )
      .orderBy(
        asc(
          sql`strftime('%Y-%m-%dT%H:00', ${checkpointLogs.createdAt}, 'unixepoch')`,
        ),
      ),
    // Hourly check-ins at entry checkpoints only (event arrivals).
    db
      .select({
        hour: sql<string>`strftime('%Y-%m-%dT%H:00Z', ${checkpointLogs.createdAt}, 'unixepoch')`,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(checkpointLogs)
      .innerJoin(checkpoints, eq(checkpoints.id, checkpointLogs.checkpointId))
      .where(
        and(isNull(checkpointLogs.deletedAt), eq(checkpoints.type, "entry")),
      )
      .groupBy(
        sql`strftime('%Y-%m-%dT%H:00', ${checkpointLogs.createdAt}, 'unixepoch')`,
      )
      .orderBy(
        asc(
          sql`strftime('%Y-%m-%dT%H:00', ${checkpointLogs.createdAt}, 'unixepoch')`,
        ),
      ),
    db
      .select({
        slug: workshops.slug,
        title: workshops.title,
        hostDepartment: workshops.hostDepartment,
        hostDepartmentAbbr: workshops.hostDepartimentAbbr,
        capacity: workshops.capacity,
        slotId: workshopTimeSlots.id,
        roundNumber: workshopTimeSlots.roundNumber,
        startsAt: workshopTimeSlots.startsAt,
        endsAt: workshopTimeSlots.endsAt,
        advance: sql<number>`(
          select count(*) from ${workshopRegistrations}
          where ${workshopRegistrations.workshopTimeSlotId} = ${workshopTimeSlots.id}
            and ${workshopRegistrations.type} = 'advance'
            and ${workshopRegistrations.deletedAt} is null
        )`.mapWith(Number),
        walkIn: sql<number>`(
          select count(*) from ${workshopRegistrations}
          where ${workshopRegistrations.workshopTimeSlotId} = ${workshopTimeSlots.id}
            and ${workshopRegistrations.type} = 'walk-in'
            and ${workshopRegistrations.deletedAt} is null
        )`.mapWith(Number),
        attended: sql<number>`(
          select count(*) from ${checkpointLogs}
          where ${checkpointLogs.checkpointId} in (
            select ${checkpoints.id} from ${checkpoints}
            where ${checkpoints.workshopTimeSlotId} = ${workshopTimeSlots.id}
              and ${checkpoints.type} = 'workshop'
              and ${checkpoints.deletedAt} is null
          )
          and ${checkpointLogs.deletedAt} is null
        )`.mapWith(Number),
        // Actual arrivals split by how the attendee got in: the checkpoint log's
        // attendance_type is set at check-in (advance if they held a booking,
        // otherwise walk-in) — unlike the registration counts above, walk-ins
        // scanned on the spot (เพิ่มคน) show up here.
        advanceArrived: sql<number>`(
          select count(*) from ${checkpointLogs}
          where ${checkpointLogs.checkpointId} in (
            select ${checkpoints.id} from ${checkpoints}
            where ${checkpoints.workshopTimeSlotId} = ${workshopTimeSlots.id}
              and ${checkpoints.type} = 'workshop'
              and ${checkpoints.deletedAt} is null
          )
          and ${checkpointLogs.attendanceType} = 'advance'
          and ${checkpointLogs.deletedAt} is null
        )`.mapWith(Number),
        walkInArrived: sql<number>`(
          select count(*) from ${checkpointLogs}
          where ${checkpointLogs.checkpointId} in (
            select ${checkpoints.id} from ${checkpoints}
            where ${checkpoints.workshopTimeSlotId} = ${workshopTimeSlots.id}
              and ${checkpoints.type} = 'workshop'
              and ${checkpoints.deletedAt} is null
          )
          and ${checkpointLogs.attendanceType} = 'walk-in'
          and ${checkpointLogs.deletedAt} is null
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
      .where(isNull(workshops.deletedAt))
      .orderBy(asc(workshops.slug), asc(workshopTimeSlots.roundNumber)),
  ]);

  const workshopStats = new Map<string, WorkshopStats>();
  for (const {
    slug,
    title,
    hostDepartment,
    hostDepartmentAbbr,
    capacity,
    slotId,
    roundNumber,
    startsAt,
    endsAt,
    advance,
    walkIn,
    attended,
    advanceArrived,
    walkInArrived,
  } of workshopRows) {
    let workshop = workshopStats.get(slug);
    if (!workshop) {
      workshop = {
        slug,
        title,
        hostDepartment,
        hostDepartmentAbbr,
        rounds: [],
      };
      workshopStats.set(slug, workshop);
    }
    if (slotId && roundNumber !== null && startsAt && endsAt) {
      workshop.rounds.push({
        slotId,
        roundNumber,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        capacity,
        advance,
        walkIn,
        attended,
        advanceArrived,
        walkInArrived,
      });
    }
  }

  return {
    registered: registeredRow?.value ?? 0,
    attended: attendedRow?.value ?? 0,
    totalCheckins: totalCheckinsRow?.value ?? 0,
    activeNow: activeNowRow?.value ?? 0,
    attendedByDay: {
      day1: attendedDay1Row?.value ?? 0,
      day2: attendedDay2Row?.value ?? 0,
      total: attendedRow?.value ?? 0,
    },
    checkinsByDay: {
      day1: checkinsDay1Row?.value ?? 0,
      day2: checkinsDay2Row?.value ?? 0,
      total: totalCheckinsRow?.value ?? 0,
    },
    booths: boothRows,
    hourly: hourlyRows,
    hourlyEntry: hourlyEntryRows,
    workshops: [...workshopStats.values()],
    updatedAt: new Date().toISOString(),
  };
}

export async function getDashboardFeed(
  db: Db,
  limit = 20,
  checkpointIds?: string[],
): Promise<DashboardFeedItem[]> {
  if (checkpointIds?.length === 0) return [];
  const rows = await db
    .select({
      id: checkpointLogs.id,
      createdAt: checkpointLogs.createdAt,
      firstname: attendees.firstname,
      lastname: attendees.lastname,
      checkpointName: checkpoints.name,
      checkpointType: checkpoints.type,
    })
    .from(checkpointLogs)
    .innerJoin(attendees, eq(attendees.id, checkpointLogs.attendeeId))
    .innerJoin(checkpoints, eq(checkpoints.id, checkpointLogs.checkpointId))
    .where(
      and(
        isNull(checkpointLogs.deletedAt),
        isNull(checkpoints.deletedAt),
        isNull(attendees.deletedAt),
        checkpointIds
          ? inArray(checkpointLogs.checkpointId, checkpointIds)
          : undefined,
      ),
    )
    .orderBy(desc(checkpointLogs.createdAt), desc(checkpointLogs.id))
    .limit(limit);

  return rows.map(({ createdAt, lastname, ...row }) => ({
    ...row,
    createdAt: (createdAt ?? new Date()).toISOString(),
    lastnameInitial: lastname ? `${lastname[0]}.` : "",
  }));
}

/** Attendees registered for one workshop round, on demand (not part of the 10 s poll). */
export async function getWorkshopRoundAttendees(
  db: Db,
  slotId: string,
): Promise<WorkshopRoundAttendee[]> {
  const rows = await db
    .select({
      id: attendees.id,
      firstname: attendees.firstname,
      lastname: attendees.lastname,
      school: attendees.school,
      registeredAt: workshopRegistrations.createdAt,
      type: sql<
        WorkshopRoundAttendee["type"]
      >`cast(${workshopRegistrations.type} as text)`,
      checkedIn: sql<boolean>`exists (
        select 1 from ${checkpointLogs} cl
        inner join ${checkpoints} cp on cp.id = cl.checkpoint_id
        where cl.attendee_id = ${attendees.id}
          and cl.deleted_at is null
          and cp.deleted_at is null
          and cp.type = 'workshop'
          and cp.workshop_time_slot_id = ${slotId}
      )`.mapWith(Boolean),
    })
    .from(workshopRegistrations)
    .innerJoin(attendees, eq(attendees.id, workshopRegistrations.attendeeId))
    .where(
      and(
        eq(workshopRegistrations.workshopTimeSlotId, slotId),
        isNull(workshopRegistrations.deletedAt),
        isNull(attendees.deletedAt),
      ),
    )
    .orderBy(asc(workshopRegistrations.createdAt));

  return rows.map(({ registeredAt, ...row }) => ({
    ...row,
    registeredAt: (registeredAt ?? new Date()).toISOString(),
  }));
}
