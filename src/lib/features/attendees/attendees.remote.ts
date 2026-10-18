// Frontend API: attendee profile queries and forms belong here.
// Pass schemas from ./schemas directly to SvelteKit's query/form/command.
// Implement identity and access checks before exposing profile operations.

import { dev } from "$app/env";
import { command, getRequestEvent, query } from "$app/server";
import { error } from "@sveltejs/kit";
import z from "zod";
import { createAttendeeProfile, getAttendeeProfile } from "./service.server";
import { customAlphabet } from "nanoid";
import {
  requirePermission,
  requireStaff,
  requireUser,
} from "../auth/guards.server";
import { err, ok, safeTry } from "neverthrow";
import { getRequestTimeGates } from "../time/time.server";
import { registrationSchema } from "#lib/registration/schema.ts";

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
  registrationSchema,
  async (input) => {
    const { locals } = getRequestEvent();
    const user = requireUser(locals.user);
    if (
      !getRequestTimeGates(getRequestEvent().cookies, dev).flags
        .generalRegistrationOpen
    )
      return err("GENERAL_REGISTRATION_NOT_OPEN" as const);

    const nanoid = customAlphabet("2345679ACDEFGHJKLMNPQRSTUVWXYZ%#@", 5);
    return safeTry(async function* () {
      while (true) {
        const qrCodeId = nanoid();
        const existingProfile = yield* await getAttendeeProfile({ qrCodeId });
        if (existingProfile) continue;

        return await createAttendeeProfile({
          title: input.prefix === "other" ? input.prefixOther : input.prefix,
          prefixOther: input.prefixOther || null,
          firstname: input.firstName,
          lastname: input.lastName,
          age: input.age,
          residentProvince: input.province,
          emergencyPhone: input.emergencyPhone,
          emergencyName: input.emergencyName,
          specialNeed: input.specialNeeds || null,
          type: input.status,
          school: input.schoolName || null,
          surveyResponses: {
            reason: input.reason,
            expectation: input.expectation,
            newsSources: input.newsSources,
            visitIntent: input.visitIntent,
            major1: input.major1,
            major2: input.major2,
            major3: input.major3,
          },
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
