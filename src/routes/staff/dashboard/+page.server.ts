import { redirect } from "@sveltejs/kit";
import { requirePermission } from "#lib/features/auth/guards.server.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) redirect(303, "/staff");
  requirePermission(locals.user, "admin");
  // The TV mode scales the dashboard up for a projector in the command room.
  return { tv: url.searchParams.get("tv") === "1" };
};
