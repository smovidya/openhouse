import { z } from "zod";

export const getWorkshopInput = z.strictObject({
  workshopId: z.string().min(1),
});

// The remote command resolves the attendee and registration type from trusted context.
const workshopRegistrationSelectionInput = z.strictObject({
  workshopSlug: z.string().min(1),
  workshopRoundNumber: z.number().int().positive(),
});

export const registerForWorkshopInput = workshopRegistrationSelectionInput;
export const unregisterFromWorkshopInput = workshopRegistrationSelectionInput;

export type GetWorkshopInput = z.infer<typeof getWorkshopInput>;
export type RegisterForWorkshopInput = z.infer<typeof registerForWorkshopInput>;
export type UnregisterFromWorkshopInput = z.infer<
  typeof unregisterFromWorkshopInput
>;
