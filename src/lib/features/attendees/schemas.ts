import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { tables } from "#lib/server/db/tables.ts";

export const attendeeProfileSelect = createSelectSchema(tables.attendees);
export const attendeeProfileInsert = createInsertSchema(tables.attendees);

export const createAttendeeProfileInput = z.strictObject({
  title: z.string().min(1).max(10),
  firstname: z.string().min(1).max(50),
  lastname: z.string().min(1).max(50),
  age: z.number().int().min(5).max(150),
  residentProvince: z.string().min(1).max(100),
  type: z.string().min(1).max(50),
  school: z.string().optional(),
  surveyResponses: z.record(z.string().min(1), z.any()).optional(),
});

export type AttendeeProfileSelect = z.infer<typeof attendeeProfileSelect>;
export type AttendeeProfileInsert = z.infer<typeof attendeeProfileInsert>;
