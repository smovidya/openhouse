import { dev } from "$app/env";
import { command, getRequestEvent, query } from "$app/server";
import { error } from "@sveltejs/kit";
import { requireSameOrigin } from "../auth/guards.server";
import { setMockTimeInput } from "./schemas";
import {
  clearMockNow as clearMockNowCookie,
  getRequestTimeGates,
  setMockNow as setMockNowCookie,
} from "./time.server";

/** Returns the effective clock, schedule, and all public feature flags. */
export const getTimeGates = query(() =>
  getRequestTimeGates(getRequestEvent().cookies, dev),
);

/** Sets this browser's fixed clock in development. Unavailable in production. */
export const setMockTime = command(setMockTimeInput, async ({ now }) => {
  if (!dev) error(404, "Not found");
  const event = getRequestEvent();
  requireSameOrigin(event);
  const gates = setMockNowCookie(event.cookies, new Date(now));
  await getTimeGates().refresh();
  return gates;
});

/** Restores this browser to the real clock in development. */
export const clearMockTime = command(async () => {
  if (!dev) error(404, "Not found");
  const event = getRequestEvent();
  requireSameOrigin(event);
  const gates = clearMockNowCookie(event.cookies);
  await getTimeGates().refresh();
  return gates;
});
