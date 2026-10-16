import { z } from "zod";

export const getWorkshopInput = z.strictObject({
  workshopId: z.string().min(1),
});

// The service resolves the attendee and registration type from trusted context.
export const registerForWorkshopInput = z.strictObject({
  workshopTimeSlotId: z.string().min(1),
});

export type GetWorkshopInput = z.infer<typeof getWorkshopInput>;
export type RegisterForWorkshopInput = z.infer<typeof registerForWorkshopInput>;
