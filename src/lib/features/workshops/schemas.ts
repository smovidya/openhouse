import { z } from "zod";

export const getWorkshopInput = z.strictObject({
  workshopId: z.string().min(1).max(128),
});

// The remote command resolves the attendee and registration type from trusted context.
const workshopRegistrationSelectionInput = z.strictObject({
  workshopSlug: z.string().min(1).max(128),
  workshopRoundNumber: z.number().int().positive(),
});

export const registerForWorkshopInput = workshopRegistrationSelectionInput;
export const unregisterFromWorkshopInput = workshopRegistrationSelectionInput;

export type GetWorkshopInput = z.infer<typeof getWorkshopInput>;
export type RegisterForWorkshopInput = z.infer<typeof registerForWorkshopInput>;
export type UnregisterFromWorkshopInput = z.infer<
  typeof unregisterFromWorkshopInput
>;

export const workshopTimeSlotInput = z.strictObject({
  workshopTimeSlotId: z.string().min(1).max(128),
});
export const checkInWorkshopInput = z.strictObject({
  workshopTimeSlotId: z.string().min(1).max(128),
  qrCodeId: z.string().min(1).max(128),
  mode: z.enum(["advance", "open"]),
});
export const setWorkshopAttendanceInput = z.strictObject({
  workshopTimeSlotId: z.string().min(1).max(128),
  attendeeId: z.string().min(1).max(128),
  present: z.boolean(),
  mode: z.enum(["advance", "open"]),
  reason: z.string().trim().min(1).max(500).optional(),
});
export type WorkshopTimeSlotInput = z.infer<typeof workshopTimeSlotInput>;
export type CheckInWorkshopInput = z.infer<typeof checkInWorkshopInput>;
export type SetWorkshopAttendanceInput = z.infer<
  typeof setWorkshopAttendanceInput
>;
