// Implement attendee profile operations here, receiving Db from #lib/server/db
// and the authenticated actor explicitly. Use AttendeeProfileInput from ./schemas.
// Generate identity fields on the server and enforce profile ownership here.

import z from "zod";
import { getDb, tables } from "#lib/server/db/index.ts";
import { env } from "cloudflare:workers";
import { err, ResultAsync } from "neverthrow";
import { type AttendeeProfileInsert } from "./schemas";

const db = getDb(env.DB);

export const getAttendeeProfile = async (query: {
  qrCodeId?: string;
  id?: string;
}) =>
  ResultAsync.fromPromise(
    db.query.attendees.findFirst({
      where: query,
    }),
    () => err("FETCH_ATTENDEE_PROFILE_FAILED"),
  );

export const createAttendeeProfile = async (input: AttendeeProfileInsert) =>
  ResultAsync.fromPromise(
    db.insert(tables.attendees).values(input).returning().get(),
    () => err("CREATE_ATTENDEE_PROFILE_FAILED"),
  );
