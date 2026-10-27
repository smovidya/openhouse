import type { AuthUser } from "#lib/features/auth/schemas.ts";

/**
 * Where a signed-in account belongs. Staff and attendees are mutually exclusive: staff use
 * /staff, attendees /myid, and an account that is neither yet registers as an attendee
 * (or enrolls as staff with an invite code on /staff).
 */
export function accountHome(user: Pick<AuthUser, "staff" | "attendee">) {
  if (user.staff) return "/staff";
  return user.attendee ? "/myid" : "/register";
}
