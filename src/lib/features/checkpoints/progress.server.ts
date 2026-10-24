import { error } from "@sveltejs/kit";
import { and, asc, eq, isNull, sql, type SQLWrapper } from "drizzle-orm";
import type { Db } from "#db";
import {
  attendees,
  checkpointLogs,
  checkpoints,
  rewardRedemptions,
  users,
  workshops,
  workshopTimeSlots,
} from "#db/tables.ts";
import { requireUser } from "../auth/guards.server";
import { findSessionUser } from "../auth/service.server";
import {
  evaluateProgress,
  tierRequirements,
  type ProgressCounts,
} from "./progress";

// Shared by progress reads and the atomic redemption query. Only attendance,
// never workshop bookings, contributes to progress.
export function progressCountsQuery(db: Db, attendeeId: string | SQLWrapper) {
  return db
    .select({
      departmentCount:
        sql<number>`count(distinct case when ${checkpoints.type} = 'booth' then ${checkpoints.department} end)`
          .mapWith(Number)
          .as("department_count"),
      workshopCount:
        sql<number>`count(distinct case when ${checkpoints.type} = 'workshop' then ${checkpointLogs.workshopId} end)`
          .mapWith(Number)
          .as("workshop_count"),
      hasTcas: sql<number>`coalesce(max(${checkpoints.type} = 'tcas'), 0)`
        .mapWith(Number)
        .as("has_tcas"),
      hasCentralActivity:
        sql<number>`coalesce(max(${checkpoints.type} = 'central_activity'), 0)`
          .mapWith(Number)
          .as("has_central_activity"),
      hasStage: sql<number>`coalesce(max(${checkpoints.type} = 'stage'), 0)`
        .mapWith(Number)
        .as("has_stage"),
      entered: sql<number>`coalesce(max(${checkpoints.type} = 'entry'), 0)`
        .mapWith(Number)
        .as("entered"),
    })
    .from(checkpointLogs)
    .innerJoin(checkpoints, eq(checkpoints.id, checkpointLogs.checkpointId))
    .where(
      and(
        eq(checkpointLogs.attendeeId, attendeeId),
        isNull(checkpointLogs.deletedAt),
        isNull(checkpoints.deletedAt),
      ),
    );
}

export function eligibleTierSql(counts: {
  departmentCount: SQLWrapper;
  workshopCount: SQLWrapper;
  hasTcas: SQLWrapper;
  hasCentralActivity: SQLWrapper;
  hasStage: SQLWrapper;
}) {
  return sql<1 | 2 | 3 | null>`case ${sql.join(
    tierRequirements.map(
      (rule) => sql`
    when ${counts.hasTcas} = 1 and ${counts.hasCentralActivity} = 1
      and ${counts.departmentCount} >= ${rule.departments}
      and ${counts.workshopCount} >= ${rule.workshops}
      and (${rule.stage ? 1 : 0} = 0 or ${counts.hasStage} = 1)
    then ${rule.tier}`,
    ),
    sql` `,
  )} else null end`;
}

/** Internal read. Public callers must establish staff access or profile ownership. */
export async function getAttendeeProgress(db: Db, attendeeId: string) {
  const [countRows, completed, redemptionRows, catalog] = await db.batch([
    progressCountsQuery(db, attendeeId),
    db
      .select({
        checkpointId: checkpointLogs.checkpointId,
        attendedAt: checkpointLogs.createdAt,
      })
      .from(checkpointLogs)
      .where(
        and(
          eq(checkpointLogs.attendeeId, attendeeId),
          isNull(checkpointLogs.deletedAt),
        ),
      ),
    db
      .select({
        id: rewardRedemptions.id,
        tier: rewardRedemptions.tier,
        giftId: rewardRedemptions.giftId,
        giftName: rewardRedemptions.giftName,
        redeemedAt: rewardRedemptions.createdAt,
        progressSnapshot: rewardRedemptions.progressSnapshot,
      })
      .from(rewardRedemptions)
      .where(
        and(
          eq(rewardRedemptions.attendeeId, attendeeId),
          isNull(rewardRedemptions.deletedAt),
        ),
      )
      .limit(1),
    db
      .select({
        id: checkpoints.id,
        name: checkpoints.name,
        type: checkpoints.type,
        department: checkpoints.department,
        workshopTimeSlotId: checkpoints.workshopTimeSlotId,
        workshopId: workshopTimeSlots.workshopId,
        workshopName: workshops.title,
        roundNumber: workshopTimeSlots.roundNumber,
        startsAt: workshopTimeSlots.startsAt,
        endsAt: workshopTimeSlots.endsAt,
      })
      .from(checkpoints)
      .leftJoin(
        workshopTimeSlots,
        eq(workshopTimeSlots.id, checkpoints.workshopTimeSlotId),
      )
      .leftJoin(workshops, eq(workshops.id, workshopTimeSlots.workshopId))
      .where(isNull(checkpoints.deletedAt))
      .orderBy(asc(checkpoints.name), asc(checkpoints.id)),
  ]);
  const row = countRows[0];
  const counts: ProgressCounts = {
    departmentCount: row.departmentCount,
    workshopCount: row.workshopCount,
    hasTcas: Boolean(row.hasTcas),
    hasCentralActivity: Boolean(row.hasCentralActivity),
    hasStage: Boolean(row.hasStage),
  };
  const attended = new Map(
    completed.map((log) => [log.checkpointId, log.attendedAt]),
  );
  const redemption = redemptionRows[0] ?? null;
  const completedWorkshops = new Set(
    catalog.flatMap((checkpoint) =>
      checkpoint.workshopId && attended.has(checkpoint.id)
        ? [checkpoint.workshopId]
        : [],
    ),
  );
  return {
    entered: Boolean(row.entered),
    counts,
    ...evaluateProgress(counts),
    redemption,
    canCollectCheckpoints: Boolean(row.entered) && !redemption,
    canAttendWorkshops: Boolean(row.entered),
    checkpoints: catalog
      .filter((checkpoint) => checkpoint.type !== "reward")
      .map((checkpoint) => ({
        ...checkpoint,
        completed: attended.has(checkpoint.id),
        attendedAt: attended.get(checkpoint.id) ?? null,
        // Other rounds of an attended workshop are not outstanding tasks.
        unavailableReason: attended.has(checkpoint.id)
          ? "ALREADY_CHECKED_IN"
          : checkpoint.type === "workshop" &&
              checkpoint.workshopId &&
              completedWorkshops.has(checkpoint.workshopId)
            ? "WORKSHOP_ALREADY_ATTENDED"
            : redemption && checkpoint.type !== "workshop"
              ? "JOURNEY_REDEEMED"
              : !row.entered && checkpoint.type !== "entry"
                ? "ENTRY_REQUIRED"
                : null,
      })),
  };
}

export async function getMyProgress(db: Db, actorId: string) {
  requireUser(await findSessionUser(db, actorId));
  const [attendee] = await db
    .select({ id: attendees.id })
    .from(attendees)
    .innerJoin(users, eq(users.id, attendees.userId))
    .where(
      and(
        eq(attendees.userId, actorId),
        isNull(attendees.deletedAt),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  if (!attendee) error(404, "ATTENDEE_NOT_FOUND");
  return getAttendeeProgress(db, attendee.id);
}
