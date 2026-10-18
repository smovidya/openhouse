import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { tables } from "#lib/server/db/tables.ts";

export const attendeeProfileSelect = createSelectSchema(tables.attendees);
export const attendeeProfileInsert = createInsertSchema(tables.attendees);

export type AttendeeProfileSelect = typeof tables.attendees.$inferSelect;
export type AttendeeProfileInsert = typeof tables.attendees.$inferInsert;
