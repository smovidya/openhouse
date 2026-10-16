import { error } from "@sveltejs/kit";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "#db";
import { checkpoints, inviteCodes, staffs, users } from "#db/tables.ts";
import {
  requirePermission,
  requireStaff,
  requireUser,
} from "../auth/guards.server";
import { findSessionUser } from "../auth/service.server";
import { staffPermissions, type StaffPermission } from "./permissions";
import type { EnrollStaffInput } from "./schemas";

const inviteColumns = {
  id: inviteCodes.id,
  permission: inviteCodes.permission,
  createdAt: inviteCodes.createdAt,
  deletedAt: inviteCodes.deletedAt,
};

async function hashCode(code: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(code.trim()),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function listBoothDepartments(db: Db, actorId: string) {
  requireUser(await findSessionUser(db, actorId));
  const rows = await db
    .selectDistinct({ department: checkpoints.department })
    .from(checkpoints)
    .where(and(eq(checkpoints.type, "booth"), isNull(checkpoints.deletedAt)))
    .orderBy(asc(checkpoints.department));
  return rows.flatMap(({ department }) => (department ? [department] : []));
}

export async function createInviteCode(
  db: Db,
  actorId: string,
  permission: StaffPermission[],
) {
  requirePermission(await findSessionUser(db, actorId), "admin");
  const parsed = staffPermissions.safeParse(permission);
  if (!parsed.success || parsed.data.length === 0)
    error(400, "Invalid permissions");
  const departments = new Set(await listBoothDepartments(db, actorId));
  for (const value of parsed.data) {
    if (
      value.startsWith("boothStaff:") &&
      value !== "boothStaff:all" &&
      !departments.has(value.slice(11))
    ) {
      error(400, "Booth department does not have an active checkpoint");
    }
  }
  const code = Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const [invite] = await db
    .insert(inviteCodes)
    .values({
      codeHash: await hashCode(code),
      permission: parsed.data,
    })
    .returning(inviteColumns);
  // The reusable bearer code is shown once. List endpoints never expose it.
  return { ...invite, code };
}

export async function listInviteCodes(
  db: Db,
  actorId: string,
  input: { offset: number; limit: number },
) {
  requirePermission(await findSessionUser(db, actorId), "admin");
  return db
    .select(inviteColumns)
    .from(inviteCodes)
    .orderBy(asc(inviteCodes.id))
    .offset(input.offset)
    .limit(input.limit);
}

export async function disableInviteCode(db: Db, actorId: string, id: string) {
  requirePermission(await findSessionUser(db, actorId), "admin");
  await db
    .update(inviteCodes)
    .set({ deletedAt: new Date() })
    .where(and(eq(inviteCodes.id, id), isNull(inviteCodes.deletedAt)));
  const [invite] = await db
    .select(inviteColumns)
    .from(inviteCodes)
    .where(eq(inviteCodes.id, id));
  if (!invite) error(404, "Invite code not found");
  return invite;
}

export async function getStaffProfile(db: Db, actorId: string) {
  requireUser(await findSessionUser(db, actorId));
  const [staff] = await db
    .select()
    .from(staffs)
    .where(and(eq(staffs.userId, actorId), isNull(staffs.deletedAt)))
    .limit(1);
  return staff ?? null;
}

export async function enrollStaff(
  db: Db,
  actorId: string,
  input: EnrollStaffInput,
) {
  requireUser(await findSessionUser(db, actorId));
  const codeHash = await hashCode(input.code);
  const [invite] = await db
    .select({ permission: inviteCodes.permission })
    .from(inviteCodes)
    .where(
      and(eq(inviteCodes.codeHash, codeHash), isNull(inviteCodes.deletedAt)),
    )
    .limit(1);
  const parsed = staffPermissions.safeParse(invite?.permission);
  if (!parsed.success || parsed.data.length === 0)
    error(400, "Invalid or disabled invite code");

  const now = Math.floor(Date.now() / 1000);
  // The code and account must still be active when the write executes. Merge in
  // SQL, so simultaneous redemptions cannot overwrite each other's permissions.
  const grant = db
    .insert(staffs)
    .select(
      db
        .select({
          id: sql<string>`${crypto.randomUUID()}`.as("id"),
          userId: users.id,
          type: sql<string>`${input.type}`.as("type"),
          name: sql<string>`${input.name}`.as("name"),
          department: sql<string | null>`${input.department}`.as("department"),
          phone: sql<string>`${input.phone}`.as("phone"),
          permission: inviteCodes.permission,
          createdAt: sql<Date>`${now}`.as("created_at"),
          updatedAt: sql<Date>`${now}`.as("updated_at"),
          deletedAt: sql<Date | null>`NULL`.as("deleted_at"),
        })
        .from(inviteCodes)
        .innerJoin(users, eq(users.id, actorId))
        .where(
          and(
            eq(inviteCodes.codeHash, codeHash),
            isNull(inviteCodes.deletedAt),
            eq(inviteCodes.permission, invite!.permission),
            isNull(users.deletedAt),
          ),
        ),
    )
    .onConflictDoUpdate({
      target: staffs.userId,
      set: {
        permission: sql<StaffPermission[]>`(
        SELECT json_group_array(value) FROM (
          SELECT value FROM json_each(${staffs.permission})
          UNION SELECT value FROM json_each(excluded.permission)
        )
      )`,
        updatedAt: new Date(),
      },
      setWhere: isNull(staffs.deletedAt),
    })
    .returning({ id: staffs.id });

  const [granted] = await db.batch([
    grant,
    db
      .update(users)
      .set({ role: "staff" })
      .where(
        and(eq(users.id, actorId), isNull(users.deletedAt), sql`changes() > 0`),
      ),
  ]);
  if (!granted.length)
    error(403, "Enrollment is no longer available for this account or code");
  return requireStaff(await findSessionUser(db, actorId));
}

export async function redeemInviteCode(db: Db, actorId: string, code: string) {
  requireStaff(await findSessionUser(db, actorId));
  const staff = await getStaffProfile(db, actorId);
  if (!staff) error(403, "Staff access required");
  return enrollStaff(db, actorId, {
    code,
    name: staff.name,
    phone: staff.phone,
    type: staff.type,
    department: staff.department,
  });
}
