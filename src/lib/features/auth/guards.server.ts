import { error } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import type { AuthUser } from "./schemas";
import { hasPermission, type StaffPermission } from "../staff/permissions";

export function requireUser(user: AuthUser | null | undefined) {
  if (!user) error(401, "Sign in required");
  return user;
}

export function requireStaff(user: AuthUser | null | undefined) {
  const actor = requireUser(user);
  if (actor.role !== "staff" || !actor.staff)
    error(403, "Staff access required");
  return { ...actor, staff: actor.staff };
}

export function requirePermission(
  user: AuthUser | null | undefined,
  permission: StaffPermission,
) {
  const actor = requireStaff(user);
  if (!hasPermission(actor.staff.permission, permission))
    error(403, "Permission required");
  return actor;
}

// SvelteKit skips its built-in origin check in development. Protect mock login
// and other auth commands there too, using the request's own origin.
export function requireSameOrigin({
  request,
  url,
}: Pick<RequestEvent, "request" | "url">) {
  if (request.headers.get("origin") !== url.origin)
    error(403, "Cross-site authentication is forbidden");
}
