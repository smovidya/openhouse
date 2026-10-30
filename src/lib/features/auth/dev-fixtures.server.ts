import { error } from "@sveltejs/kit";
import type { Db } from "#db";
import { attendees, staffs, users } from "#db/tables.ts";
import {
  specialBoothScopes,
  staffPermission,
  type StaffPermission,
} from "../staff/permissions";
import type { DevProfile } from "./schemas";
import { findSessionUser } from "./service.server";

/** The development staff fixture holds every staff role, so every staff page can be tried. */
const devStaffPermissions: StaffPermission[] = [
  ...staffPermission.options[0].options,
  ...specialBoothScopes.map((scope) => scope.permission),
];

export async function ensureDevFixture(
  db: Db,
  profile: DevProfile,
  development: boolean,
) {
  if (!development) error(404, "Not found");
  // Each newcomer starts a separate registration. Registered attendee/staff
  // fixtures remain repeatable and keep any local changes made to them, except
  // the staff fixture's permissions, which are reset to every role.
  const fixture =
    profile === "newcomer" ? `newcomer-${crypto.randomUUID()}` : profile;
  const id = `dev-user-${fixture}`;
  const insertUser = db
    .insert(users)
    .values({
      id,
      googleId: `__development__:${fixture}`,
      email: `${fixture}@example.invalid`,
      name: `Development ${profile}`,
      role: profile === "staff" ? "staff" : "attendee",
    })
    .onConflictDoNothing();

  // A newcomer is an attendee user who hasn't filled in the registration form yet.
  if (profile === "newcomer") {
    await insertUser;
    const user = await findSessionUser(db, id);
    if (!user) error(403, "This development account is unavailable");
    return user;
  }

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
            permission: devStaffPermissions,
          })
          .onConflictDoUpdate({
            target: staffs.id,
            set: { permission: devStaffPermissions },
          });

  await db.batch([insertUser, insertProfile]);
  const user = await findSessionUser(db, id);
  if (!user) error(403, "This development account is unavailable");
  return user;
}
