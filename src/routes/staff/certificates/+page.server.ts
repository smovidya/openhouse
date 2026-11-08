import { requirePermission } from "#lib/features/auth/guards.server.ts";
import type { PageServerLoad } from "./$types";
export const load: PageServerLoad = ({ locals }) => {
  requirePermission(locals.user, "admin");
  return {};
};
