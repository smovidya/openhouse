import { z } from "zod";

export const attendeeProfileInput = z.strictObject({
  title: z.string().min(1),
  firstname: z.string().min(1),
  lastname: z.string().min(1),
  age: z.int().nonnegative(),
  residentProvince: z.string().min(1),
  type: z.string().min(1),
  school: z.string().nullable().optional(),
});

export type AttendeeProfileInput = z.infer<typeof attendeeProfileInput>;
