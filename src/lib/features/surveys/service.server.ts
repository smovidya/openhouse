// Evaluation (ฟอร์มประเมินผล) persistence. Responses are Non-PII and live in the
// existing survey_responses JSON column; only the strict shape from ./schemas is
// accepted. Resubmission rules: one active response per attendee — a second
// submit is rejected with ALREADY_SUBMITTED (the page hides the form after sending).

import { env } from "cloudflare:workers";
import { and, eq, isNull } from "drizzle-orm";
import { err, ok, ResultAsync } from "neverthrow";
import { getDb, tables } from "#lib/server/db/index.ts";
import type { EvaluationResponse } from "./schemas";

export const getEvaluationResponse = (attendeeId: string) => {
  const db = getDb(env.DB);
  return ResultAsync.fromPromise(
    db.query.surveyResponses.findFirst({
      where: { attendeeId, deletedAt: { isNull: true } },
    }),
    () => "FETCH_EVALUATION_FAILED" as const,
  ).map((row) => (row?.answer as EvaluationResponse | undefined) ?? null);
};

/** Whether the attendee has checked in at the central entry checkpoint. */
export const hasAttendeeEntered = (attendeeId: string) => {
  const db = getDb(env.DB);
  const { checkpoints, checkpointLogs } = tables;
  return ResultAsync.fromPromise(
    db
      .select({ id: checkpointLogs.id })
      .from(checkpointLogs)
      .innerJoin(checkpoints, eq(checkpoints.id, checkpointLogs.checkpointId))
      .where(
        and(
          eq(checkpointLogs.attendeeId, attendeeId),
          eq(checkpoints.type, "entry"),
          isNull(checkpointLogs.deletedAt),
          isNull(checkpoints.deletedAt),
        ),
      )
      .limit(1),
    () => "FETCH_EVALUATION_FAILED" as const,
  ).map((rows) => rows.length > 0);
};

export type SubmitEvaluationError =
  | "ATTENDEE_NOT_FOUND"
  | "ENTRY_REQUIRED"
  | "EVALUATION_NOT_OPEN"
  | "ALREADY_SUBMITTED"
  | "SUBMIT_EVALUATION_FAILED";

export const submitEvaluationResponse = (input: {
  attendeeId: string;
  answer: EvaluationResponse;
}) => {
  const db = getDb(env.DB);
  return ResultAsync.fromPromise(
    db
      .insert(tables.surveyResponses)
      .values({ attendeeId: input.attendeeId, answer: input.answer })
      .returning()
      .get(),
    (): SubmitEvaluationError => "SUBMIT_EVALUATION_FAILED",
  ).andThen((row) => (row ? ok(row) : err("SUBMIT_EVALUATION_FAILED")));
};
