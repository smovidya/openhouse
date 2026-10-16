import { error } from "@sveltejs/kit";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "#db";
import { staffs, users } from "#db/tables.ts";
import { staffPermissions } from "../staff/permissions";
import type { GoogleIdentity } from "./google.server";
import type { AuthUser } from "./schemas";

const publicUserColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  image: users.image,
  role: users.role,
};

export async function findSessionUser(
  db: Db,
  userId: string,
): Promise<AuthUser | null> {
  const [user] = await db
    .select({
      ...publicUserColumns,
      staffId: staffs.id,
      permission: staffs.permission,
    })
    .from(users)
    .leftJoin(
      staffs,
      and(eq(staffs.userId, users.id), isNull(staffs.deletedAt)),
    )
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  if (!user) return null;
  const { staffId, permission, ...identity } = user;
  const parsed = staffPermissions.safeParse(permission);
  return {
    ...identity,
    staff:
      identity.role === "staff" && staffId
        ? { id: staffId, permission: parsed.success ? parsed.data : [] }
        : null,
  };
}

export async function findOrCreateGoogleUser(
  db: Db,
  identity: GoogleIdentity,
): Promise<AuthUser> {
  const profile = {
    email: identity.email,
    name: identity.name ?? identity.email,
    image: identity.picture ?? null,
  };
  const [user] = await db
    .insert(users)
    .values({
      googleId: identity.sub,
      ...profile,
      role: "attendee",
    })
    .onConflictDoUpdate({
      target: users.googleId,
      set: profile,
      setWhere: isNull(users.deletedAt),
    })
    .returning(publicUserColumns);

  // A disabled account remains disabled; signing in must not resurrect it.
  if (!user) error(403, "This account is unavailable");
  const sessionUser = await findSessionUser(db, user.id);
  if (!sessionUser) error(403, "This account is unavailable");
  return sessionUser;
}
