import { error } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import type { AuthUser } from "./schemas";

export function requireUser(user: AuthUser | null | undefined) {
  if (!user) error(401, "Sign in required");
  return user;
}

export function requireStaff(user: AuthUser | null | undefined) {
  const actor = requireUser(user);
  if (actor.role !== "staff") error(403, "Staff access required");
  return actor;
}

// SvelteKit skips its built-in origin check in development. Protect mock login
// and other auth commands there too, using the request's own origin.
export function requireSameOrigin({ request, url }: Pick<RequestEvent, "request" | "url">) {
  if (request.headers.get("origin") !== url.origin) error(403, "Cross-site authentication is forbidden");
}
