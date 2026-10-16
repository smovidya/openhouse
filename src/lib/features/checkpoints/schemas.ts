import { z } from "zod";

// The QR code identifies the attendee; the service determines the checker.
export const checkInAttendeeInput = z.strictObject({
  qrCodeId: z.string().min(1),
  checkpointId: z.string().min(1),
});

export type CheckInAttendeeInput = z.infer<typeof checkInAttendeeInput>;

export const listCheckpointsInput = z.strictObject({
  offset: z.int().nonnegative().default(0),
  limit: z.int().min(1).max(100).default(50),
});
