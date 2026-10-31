// Frontend API for the evaluation form (ฟอร์มประเมินผล). The attendee is resolved
// from the signed-in user, never from client input, and entry is enforced on the
// server even when the page is bypassed.

import { dev } from "$app/env";
import { command, getRequestEvent, query } from "$app/server";
import { err, ok, safeTry } from "neverthrow";
import { getActiveAttendeeByUserId } from "../attendees/service.server";
import { requireSameOrigin, requireUser } from "../auth/guards.server";
import { getRequestTimeGates } from "../time/time.server";
import { evaluationResponseSchema } from "./schemas";
import * as service from "./service.server";
import type { SubmitEvaluationError } from "./service.server";

export const getMyEvaluationResponse = query(async () => {
  const user = requireUser(getRequestEvent().locals.user);
  return safeTry(async function* () {
    const attendee = yield* getActiveAttendeeByUserId(user.id).mapErr(
      (error) =>
        error === "ATTENDEE_NOT_FOUND"
          ? ("NO_ATTENDEE_PROFILE_FOUND" as const)
          : ("FETCH_EVALUATION_FAILED" as const),
    );
    const response = yield* await service.getEvaluationResponse(attendee.id);
    return ok(response);
  });
});

export const submitMyEvaluationResponse = command(
  evaluationResponseSchema,
  async (input) => {
    const event = getRequestEvent();
    requireSameOrigin(event);
    const user = requireUser(event.locals.user);

    // Same-day feedback: the form opens once the event starts, and the entry
    // check below ties it to attendees who actually came.
    const gates = getRequestTimeGates(event.cookies, dev);
    if (Date.parse(gates.now) < Date.parse(gates.schedule.eventStartsAt)) {
      return err<never, SubmitEvaluationError>("EVALUATION_NOT_OPEN");
    }

    return safeTry(async function* () {
      const attendee = yield* getActiveAttendeeByUserId(user.id).mapErr(
        (error): SubmitEvaluationError =>
          error === "ATTENDEE_NOT_FOUND"
            ? "ATTENDEE_NOT_FOUND"
            : "SUBMIT_EVALUATION_FAILED",
      );
      const entered = yield* await service.hasAttendeeEntered(attendee.id);
      if (!entered) return err<never, SubmitEvaluationError>("ENTRY_REQUIRED");
      const existing = yield* await service.getEvaluationResponse(attendee.id);
      if (existing)
        return err<never, SubmitEvaluationError>("ALREADY_SUBMITTED");
      return service.submitEvaluationResponse({
        attendeeId: attendee.id,
        answer: input,
      });
    });
  },
);
