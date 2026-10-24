import { env } from "cloudflare:workers";
import { getAuthDb } from "#lib/features/auth/config.server.ts";
import { getStaffProfile } from "#lib/features/staff/service.server.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => ({
  // Pending profiles stay separate from the session's authorized staff identity.
  staffProfile: locals.user
    ? await getStaffProfile(getAuthDb(env), locals.user.id)
    : null,
});
