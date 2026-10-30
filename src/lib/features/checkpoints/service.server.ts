import { error } from "@sveltejs/kit";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Db } from "#db";
import {
  attendees,
  checkpointLogs,
  checkpoints,
  rewardRedemptions,
  users,
} from "#db/tables.ts";
import { requireStaff } from "../auth/guards.server";
import { findSessionUser } from "../auth/service.server";
import {
  canScanCheckpoint,
  specialBoothScopes,
  type StaffPermission,
} from "../staff/permissions";
import { getAttendeeProgress } from "./progress.server";
import type {
  CheckInAttendeeInput,
  RemoveStageAttendanceInput,
} from "./schemas";

function accessibleCheckpoints(permission: StaffPermission[]) {
  if (permission.includes("admin")) return sql`1 = 1`;
  if (permission.includes("activityStaff"))
    return or(
      inArray(checkpoints.type, [
        "entry",
        "tcas",
        "central_activity",
        "stage",
        "reward",
        "workshop",
      ]),
      and(eq(checkpoints.type, "booth"), isNotNull(checkpoints.department)),
    )!;
  const conditions: SQL[] = [];
  if (permission.includes("workshopStaff"))
    conditions.push(eq(checkpoints.type, "workshop"));
  for (const scope of specialBoothScopes) {
    if (permission.includes(scope.permission))
      conditions.push(eq(checkpoints.type, scope.type));
  }
  const departments = permission
    .filter((value) => value.startsWith("boothStaff:"))
    .map((value) => value.slice(11));
  if (departments.length)
    conditions.push(
      and(
        eq(checkpoints.type, "booth"),
        permission.includes("boothStaff:all")
          ? isNotNull(checkpoints.department)
          : inArray(checkpoints.department, departments),
      )!,
    );
  return conditions.length ? or(...conditions)! : sql`1 = 0`;
}

export async function listScannableCheckpoints(
  db: Db,
  actorId: string,
  input: { offset: number; limit: number },
) {
  const actor = requireStaff(await findSessionUser(db, actorId));
  return db
    .select()
    .from(checkpoints)
    .where(
      and(
        isNull(checkpoints.deletedAt),
        accessibleCheckpoints(actor.staff.permission),
      ),
    )
    .orderBy(asc(checkpoints.id))
    .offset(input.offset)
    .limit(input.limit);
}

export async function findAttendeeByQrCode(db: Db, qrCodeId: string) {
  const [attendee] = await db
    .select({
      id: attendees.id,
      firstname: attendees.firstname,
      lastname: attendees.lastname,
      email: users.email,
    })
    .from(attendees)
    .innerJoin(users, eq(users.id, attendees.userId))
    .where(
      and(
        eq(attendees.qrCodeId, qrCodeId),
        isNull(attendees.deletedAt),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  if (!attendee) error(404, "ATTENDEE_NOT_FOUND");
  return attendee;
}

export async function getStaffAttendeeProgress(
  db: Db,
  actorId: string,
  qrCodeId: string,
) {
  requireStaff(await findSessionUser(db, actorId));
  const attendee = await findAttendeeByQrCode(db, qrCodeId);
  return { attendee, progress: await getAttendeeProgress(db, attendee.id) };
}

export async function listAttendeeCheckpointLogs(
  db: Db,
  actorId: string,
  input: { qrCodeId: string; offset: number; limit: number },
) {
  requireStaff(await findSessionUser(db, actorId));
  const attendee = await findAttendeeByQrCode(db, input.qrCodeId);
  return db
    .select({
      id: checkpointLogs.id,
      checkpointId: checkpoints.id,
      checkpointName: checkpoints.name,
      checkpointType: checkpoints.type,
      checkerId: checkpointLogs.checkerId,
      createdAt: checkpointLogs.createdAt,
      deletedAt: checkpointLogs.deletedAt,
      removedById: checkpointLogs.removedById,
      removalReason: checkpointLogs.removalReason,
      workshopId: checkpointLogs.workshopId,
      attendanceType: checkpointLogs.attendanceType,
    })
    .from(checkpointLogs)
    .innerJoin(checkpoints, eq(checkpoints.id, checkpointLogs.checkpointId))
    .where(eq(checkpointLogs.attendeeId, attendee.id))
    .orderBy(desc(checkpointLogs.createdAt), desc(checkpointLogs.id))
    .offset(input.offset)
    .limit(input.limit);
}

export async function checkInAttendee(
  db: Db,
  actorId: string,
  input: CheckInAttendeeInput,
) {
  const actor = requireStaff(await findSessionUser(db, actorId));
  const [checkpoint] = await db
    .select()
    .from(checkpoints)
    .where(
      and(
        eq(checkpoints.id, input.checkpointId),
        isNull(checkpoints.deletedAt),
      ),
    )
    .limit(1);
  if (!checkpoint) error(404, "CHECKPOINT_NOT_FOUND");
  if (!canScanCheckpoint(actor.staff.permission, checkpoint))
    error(403, "CHECKPOINT_ACCESS_DENIED");
  // These workflows have stronger rules and must never use the generic scan path.
  if (checkpoint.type === "workshop" || checkpoint.type === "reward")
    error(400, "SPECIALIZED_CHECK_IN_REQUIRED");
  const attendee = await findAttendeeByQrCode(db, input.qrCodeId);
  const candidate = db
    .select({
      attendeeId: sql<string>`${attendees.id}`.as("attendee_id"),
      checkpointId: sql<string>`${checkpoints.id}`.as("checkpoint_id"),
      rejection: sql<string | null>`case
      when exists (select 1 from ${rewardRedemptions} where ${rewardRedemptions.attendeeId} = ${attendees.id} and ${rewardRedemptions.deletedAt} is null)
        then 'JOURNEY_REDEEMED'
      when ${checkpoints.type} <> 'entry' and not exists (
        select 1 from checkpoint_logs as entry_log inner join checkpoints as entry_point on entry_point.id = entry_log.checkpoint_id
        where entry_log.attendee_id = ${attendees.id} and entry_log.deleted_at is null and entry_point.deleted_at is null and entry_point.type = 'entry'
      ) then 'ENTRY_REQUIRED'
      when exists (select 1 from ${checkpointLogs} where ${checkpointLogs.attendeeId} = ${attendees.id}
        and ${checkpointLogs.deletedAt} is null and (${checkpointLogs.checkpointId} = ${checkpoints.id}
          or (${checkpoints.type} = 'entry' and ${checkpointLogs.checkpointId} in (select id from checkpoints where type = 'entry'))))
        then 'ALREADY_CHECKED_IN'
      else null end`.as("rejection"),
    })
    .from(attendees)
    .innerJoin(users, eq(users.id, attendees.userId))
    .innerJoin(checkpoints, eq(checkpoints.id, checkpoint.id))
    .where(
      and(
        eq(attendees.id, attendee.id),
        isNull(attendees.deletedAt),
        isNull(users.deletedAt),
        isNull(checkpoints.deletedAt),
        eq(checkpoints.type, checkpoint.type),
        accessibleCheckpoints(actor.staff.permission),
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
          checkerId: sql<string>`${actor.staff.id}`.as("checker_id"),
          workshopId: sql<null>`null`.as("workshop_id"),
          attendanceType: sql<null>`null`.as("attendance_type"),
          removedById: sql<null>`null`.as("removed_by_id"),
          removalReason: sql<null>`null`.as("removal_reason"),
          createdAt: sql<Date>`${now}`.as("created_at"),
          updatedAt: sql<Date>`${now}`.as("updated_at"),
          deletedAt: sql<null>`null`.as("deleted_at"),
        })
        .from(candidate)
        .where(isNull(candidate.rejection)),
    )
    .returning({ id: checkpointLogs.id, createdAt: checkpointLogs.createdAt });
  // Eligibility and its error reason share the same D1 transaction with the write.
  const [candidates, created] = await db.batch([
    db.select().from(candidate),
    insert,
  ]);
  if (!created[0]) error(409, candidates[0]?.rejection ?? "CHECKPOINT_CHANGED");
  return {
    attendee,
    checkpointId: checkpoint.id,
    log: created[0],
    alreadyCheckedIn: false,
    progress: await getAttendeeProgress(db, attendee.id),
  };
}

export async function removeStageAttendance(
  db: Db,
  actorId: string,
  input: RemoveStageAttendanceInput,
) {
  const actor = requireStaff(await findSessionUser(db, actorId));
  const [log] = await db
    .select({
      attendeeId: checkpointLogs.attendeeId,
      type: checkpoints.type,
      department: checkpoints.department,
    })
    .from(checkpointLogs)
    .innerJoin(checkpoints, eq(checkpoints.id, checkpointLogs.checkpointId))
    .where(eq(checkpointLogs.id, input.logId))
    .limit(1);
  if (!log) error(404, "ATTENDANCE_NOT_FOUND");
  if (!canScanCheckpoint(actor.staff.permission, log))
    error(403, "CHECKPOINT_ACCESS_DENIED");
  if (log.type !== "stage") error(400, "ONLY_STAGE_ATTENDANCE_CAN_BE_REMOVED");
  const [removed] = await db
    .update(checkpointLogs)
    .set({
      deletedAt: new Date(),
      removedById: actor.staff.id,
      removalReason: input.reason,
    })
    .where(
      and(
        eq(checkpointLogs.id, input.logId),
        isNull(checkpointLogs.deletedAt),
        sql`exists (select 1 from ${checkpoints} where ${checkpoints.id} = ${checkpointLogs.checkpointId} and ${checkpoints.type} = 'stage')`,
        sql`not exists (select 1 from ${rewardRedemptions} where ${rewardRedemptions.attendeeId} = ${checkpointLogs.attendeeId} and ${rewardRedemptions.deletedAt} is null)`,
      ),
    )
    .returning({ id: checkpointLogs.id });
  if (!removed) error(409, "ATTENDANCE_ALREADY_REMOVED_OR_JOURNEY_REDEEMED");
  return {
    removed: true,
    attendeeId: log.attendeeId,
    progress: await getAttendeeProgress(db, log.attendeeId),
  };
}
