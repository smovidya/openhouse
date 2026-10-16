import { error } from "@sveltejs/kit";
import type { Db } from "#db";
import { attendees, staffs, users } from "#db/tables.ts";
import type { DevProfile } from "./schemas";
import { findSessionUser } from "./service.server";

export async function ensureDevFixture(
  db: Db,
  profile: DevProfile,
  development: boolean,
) {
  if (!development) error(404, "Not found");
  const id = `dev-user-${profile}`;
  // Deterministic IDs make fixtures repeatable. Existing records are not reset,
  // allowing role changes and disabled-account behavior to be tested locally.
  const insertUser = db
    .insert(users)
    .values({
      id,
      googleId: `__development__:${profile}`,
      email: `${profile}@example.invalid`,
      name: `Development ${profile}`,
      role: profile,
    })
    .onConflictDoNothing();

  const insertProfile =
    profile === "attendee"
      ? db
          .insert(attendees)
          .values({
            id: "dev-attendee",
            qrCodeId: "dev-attendee-qr",
            userId: id,
            title: "Mx",
            firstname: "Development",
            lastname: "Attendee",
            age: 18,
            residentProvince: "Bangkok",
            type: "student",
            school: "Development school",
          })
          .onConflictDoNothing()
      : db
          .insert(staffs)
          .values({
            id: "dev-staff",
            userId: id,
            type: "development",
            name: "Development staff",
            phone: "0000000000",
            permission: "development",
          })
          .onConflictDoNothing();

  await db.batch([insertUser, insertProfile]);
  const user = await findSessionUser(db, id);
  if (!user) error(403, "This development account is unavailable");
  return user;
}
