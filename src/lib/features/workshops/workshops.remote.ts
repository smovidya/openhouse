// Frontend API: workshop queries and registration commands belong here.
// Validate with ./schemas, obtain the request's D1 binding, and call ./service.server.
// Refresh affected queries after successful mutations.
import { dev } from "$app/env";
import { command, getRequestEvent, query } from "$app/server";
import z from "zod";
import { err } from "neverthrow";
import {
  getWorkshopRegistrationGateError,
  getWorkshopUnregistrationGateError,
} from "#lib/constants/time.ts";
import { getActiveAttendeeByUserId } from "../attendees/service.server";
import { requireSameOrigin, requireUser } from "../auth/guards.server";
import {
  registerForWorkshopInput,
  unregisterFromWorkshopInput,
} from "./schemas";
import * as workshopService from "./service.server";
import { getRequestTimeGates } from "../time/time.server";

export const listWorkshops = query(async () => workshopService.listWorkshops());
export const getWorkshopBySlug = query(
  z.string().min(1),
  async (slug: string) => workshopService.getWorkshop({ slug }),
);

export const getMyWorkshopRegistrations = query(() => {
  const user = requireUser(getRequestEvent().locals.user);
  return getActiveAttendeeByUserId(user.id).andThen((attendee) =>
    workshopService.getWorkshopRegistrationsByAttendeeId(attendee.id),
  );
});

async function refreshWorkshopQueries(workshopSlug: string) {
  await Promise.all([
    listWorkshops().refresh(),
    getWorkshopBySlug(workshopSlug).refresh(),
    getMyWorkshopRegistrations().refresh(),
  ]);
}

export const registerForWorkshop = command(
  registerForWorkshopInput,
  async (input) => {
    const event = getRequestEvent();
    requireSameOrigin(event);
    const user = requireUser(event.locals.user);
    const gates = getRequestTimeGates(event.cookies, dev);
    const gateError = getWorkshopRegistrationGateError(gates);
    if (gateError) return err(gateError);
    const result = await getActiveAttendeeByUserId(user.id).andThen(
      (attendee) =>
        workshopService.registerForWorkshop({
          ...input,
          attendeeId: attendee.id,
          type: "advance",
          now: new Date(gates.now),
        }),
    );
    if (result.isOk()) await refreshWorkshopQueries(input.workshopSlug);
    return result;
  },
);

export const unregisterFromWorkshop = command(
  unregisterFromWorkshopInput,
  async (input) => {
    const event = getRequestEvent();
    requireSameOrigin(event);
    const user = requireUser(event.locals.user);
    const gateError = getWorkshopUnregistrationGateError(
      getRequestTimeGates(event.cookies, dev),
    );
    if (gateError) return err(gateError);
    const result = await getActiveAttendeeByUserId(user.id).andThen(
      (attendee) =>
        workshopService.unregisterFromWorkshop({
          ...input,
          attendeeId: attendee.id,
        }),
    );
    if (result.isOk()) await refreshWorkshopQueries(input.workshopSlug);
    return result;
  },
);
