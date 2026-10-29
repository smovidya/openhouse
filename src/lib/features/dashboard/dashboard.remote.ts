import { env } from "cloudflare:workers";
import { getRequestEvent, query } from "$app/server";
import { z } from "zod";
import { getAuthDb } from "../auth/config.server";
import { requirePermission } from "../auth/guards.server";
import * as service from "./service.server";

function requireAdmin() {
  requirePermission(getRequestEvent().locals.user, "admin");
}

export const getDashboardStats = query(async () => {
  requireAdmin();
  return service.getDashboardStats(getAuthDb(env));
});

export const getDashboardFeed = query(async () => {
  requireAdmin();
  return service.getDashboardFeed(getAuthDb(env));
});

export const getWorkshopRoundAttendees = query(
  z.string().min(1),
  async (slotId: string) => {
    requireAdmin();
    return service.getWorkshopRoundAttendees(getAuthDb(env), slotId);
  },
);
