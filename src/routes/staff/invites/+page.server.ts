import { env } from "cloudflare:workers";
import { error, redirect } from "@sveltejs/kit";
import { getAuthDb } from "#lib/features/auth/config.server.ts";
import { requirePermission } from "#lib/features/auth/guards.server.ts";
import {
  listBoothDepartments,
  listInviteCodes,
} from "#lib/features/staff/service.server.ts";
import type { PageServerLoad } from "./$types";

const pageSize = 20;

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) redirect(303, "/staff");
  const actor = requirePermission(locals.user, "admin");
  const page = Number(url.searchParams.get("page") ?? "1");
  if (!Number.isSafeInteger(page) || page < 1 || page > 100_000)
    error(400, "Invalid page");

  const db = getAuthDb(env);
  const [invites, departments] = await Promise.all([
    listInviteCodes(db, actor.id, {
      offset: (page - 1) * pageSize,
      limit: pageSize + 1,
    }),
    listBoothDepartments(db, actor.id),
  ]);
  return {
    invites: invites.slice(0, pageSize),
    departments,
    page,
    hasNextPage: invites.length > pageSize,
  };
};
