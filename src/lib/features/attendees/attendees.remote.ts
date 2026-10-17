// Frontend API: attendee profile queries and forms belong here.
// Pass schemas from ./schemas directly to SvelteKit's query/form/command.
// Implement identity and access checks before exposing profile operations.

import { command, getRequestEvent, query } from "$app/server";
import { error } from "@sveltejs/kit";
import z from "zod";
import { createAttendeeProfile, getAttendeeProfile } from "./service.server";
import { createAttendeeProfileInput } from "./schemas";
import { customAlphabet } from "nanoid";
import {
  requirePermission,
  requireStaff,
  requireUser,
} from "../auth/guards.server";
import { err, ok, safeTry } from "neverthrow";

export const getAttendeeProfileByQrCodeId = query(
  z.string(),
  async (qrCodeId: string) => {
    const { locals } = getRequestEvent();
    requireStaff(locals.user);

    return safeTry(async function* () {
      const profile = yield* await getAttendeeProfile({ qrCodeId });
      if (!profile) return err("NO_ATTENDEE_PROFILE_FOUND");
      return ok(profile);
    }).match(
      (profile) => profile,
      () => error(404, "No attendee profile found for QR code"),
    );
  },
);

export const selfRegisterAttendee = command(
  createAttendeeProfileInput,
  async (input) => {
    const { locals } = getRequestEvent();
    const user = requireUser(locals.user);

    const nanoid = customAlphabet("2345679ACDEFGHJKLMNPQRSTUVWXYZ%#@", 5);
    return safeTry(async function* () {
      while (true) {
        const qrCodeId = nanoid();
        const existingProfile = yield* await getAttendeeProfile({ qrCodeId });
        if (existingProfile) continue;

        return await createAttendeeProfile({
          ...input,
          userId: user.id,
          qrCodeId,
        });
      }
    });
  },
);

export const getMyAttendeeProfile = query(async () => {
  const { locals } = getRequestEvent();
  requireUser(locals.user);
  return safeTry(async function* () {
    const profile = yield* await getAttendeeProfile({ id: locals.user?.id });
    if (!profile) return err("NO_ATTENDEE_PROFILE_FOUND");
    return ok(profile);
  });
});
