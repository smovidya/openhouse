import { error } from "@sveltejs/kit";
import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Db } from "#db";
import { attendees, checkpointLogs, checkpoints, users } from "#db/tables.ts";
import { requireStaff } from "../auth/guards.server";
import { findSessionUser } from "../auth/service.server";
import {
  canScanCheckpoint,
  specialBoothScopes,
  type StaffPermission,
} from "../staff/permissions";
import type { CheckInAttendeeInput } from "./schemas";

function accessibleCheckpoints(permission: StaffPermission[]) {
  if (permission.includes("admin")) return sql`1 = 1`;
  const conditions: SQL[] = [];
  if (permission.includes("workshopStaff"))
    conditions.push(eq(checkpoints.type, "workshop"));
  if (permission.includes("activityStaff"))
    conditions.push(inArray(checkpoints.type, ["entry", "stage", "reward"]));
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
  if (!checkpoint) error(404, "Checkpoint not found");
  if (!canScanCheckpoint(actor.staff.permission, checkpoint))
    error(403, "No access to this checkpoint");

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
        eq(attendees.qrCodeId, input.qrCodeId),
        isNull(attendees.deletedAt),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  if (!attendee) error(404, "Attendee not found");

  const [created] = await db
    .insert(checkpointLogs)
    .values({
      attendeeId: attendee.id,
      checkpointId: checkpoint.id,
      checkerId: actor.staff.id,
    })
    .onConflictDoNothing()
    .returning({ id: checkpointLogs.id, createdAt: checkpointLogs.createdAt });
  const log =
    created ??
    (
      await db
        .select({ id: checkpointLogs.id, createdAt: checkpointLogs.createdAt })
        .from(checkpointLogs)
        .where(
          and(
            eq(checkpointLogs.attendeeId, attendee.id),
            eq(checkpointLogs.checkpointId, checkpoint.id),
            isNull(checkpointLogs.deletedAt),
          ),
        )
        .limit(1)
    )[0];
  if (!log) error(409, "Checkpoint changed; scan again");
  return {
    attendee,
    checkpointId: checkpoint.id,
    log,
    alreadyCheckedIn: !created,
  };
}
