// Implement attendee profile operations here, receiving Db from #lib/server/db
// and the authenticated actor explicitly. Use AttendeeProfileInput from ./schemas.
// Generate identity fields on the server and enforce profile ownership here.

import z from "zod";
import { getDb, tables } from "#lib/server/db/index.ts";
import { env } from "cloudflare:workers";
import { err, ok, ResultAsync } from "neverthrow";
import { type AttendeeProfileInsert } from "./schemas";

export const getActiveAttendeeByUserId = (userId: string) => {
  const db = getDb(env.DB);
  return ResultAsync.fromPromise(
    db.query.attendees.findFirst({
      columns: { id: true },
      where: { userId, deletedAt: { isNull: true } },
    }),
    () => "FETCH_ATTENDEE_PROFILE_FAILED" as const,
  ).andThen((attendee) =>
    attendee ? ok(attendee) : err("ATTENDEE_NOT_FOUND" as const),
  );
};

export const getAttendeeProfile = (query: {
  qrCodeId?: string;
  id?: string;
}) => {
  const db = getDb(env.DB);
  return ResultAsync.fromPromise(
    db.query.attendees.findFirst({
      where: query,
    }),
    () => "FETCH_ATTENDEE_PROFILE_FAILED" as const,
  );
};

export const createAttendeeProfile = (input: AttendeeProfileInsert) => {
  const db = getDb(env.DB);
  return ResultAsync.fromPromise(
    db.insert(tables.attendees).values(input).returning().get(),
    () => "CREATE_ATTENDEE_PROFILE_FAILED" as const,
  );
};
