import { env } from "cloudflare:workers";
import { getRequestEvent, query } from "$app/server";
import { z } from "zod";
import { getAuthDb } from "../auth/config.server";
import { requirePermission } from "../auth/guards.server";
import * as service from "./service.server";
import { getSouvenirStats } from "./souvenirs.server";

function requireAdmin() {
  requirePermission(getRequestEvent().locals.user, "admin");
}

export const getDashboardSouvenirs = query(async () => {
  requireAdmin();
  return getSouvenirStats(getAuthDb(env));
});

export const getDashboardStats = query(async () => {
  requireAdmin();
  return service.getDashboardStats(getAuthDb(env));
});

export const getDashboardFeed = query(async () => {
  requireAdmin();
  return service.getDashboardFeed(getAuthDb(env));
});

export const getDashboardBoothFeed = query(
  z.array(z.string().min(1)).min(1).max(100),
  async (checkpointIds) => {
    requireAdmin();
    return service.getDashboardFeed(getAuthDb(env), 8, checkpointIds);
  },
);

export const getWorkshopRoundAttendees = query(
  z.string().min(1),
  async (slotId: string) => {
    requireAdmin();
    return service.getWorkshopRoundAttendees(getAuthDb(env), slotId);
  },
);
