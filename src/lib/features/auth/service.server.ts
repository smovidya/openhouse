import { error } from "@sveltejs/kit";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "#db";
import { users } from "#db/tables.ts";
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
    .select(publicUserColumns)
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  return user ?? null;
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
  return user;
}
