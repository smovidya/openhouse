import { z } from "zod";

// The QR code identifies the attendee; the service determines the checker.
export const checkInAttendeeInput = z.strictObject({
  qrCodeId: z.string().min(1).max(128),
  checkpointId: z.string().min(1).max(128),
});

export type CheckInAttendeeInput = z.infer<typeof checkInAttendeeInput>;

export const listCheckpointsInput = z.strictObject({
  offset: z.int().nonnegative().default(0),
  limit: z.int().min(1).max(100).default(50),
});

export const attendeeProgressInput = z.strictObject({
  qrCodeId: z.string().min(1).max(128),
});

export const attendeeLogsInput = listCheckpointsInput.extend(
  attendeeProgressInput.shape,
);

// Booth staff's check-in history: their booths, or one of them.
export const boothHistoryInput = listCheckpointsInput.extend({
  checkpointId: z.string().min(1).max(128).optional(),
});

export const removeStageAttendanceInput = z.strictObject({
  logId: z.string().min(1).max(128),
  reason: z.string().trim().min(1).max(500),
});
export type RemoveStageAttendanceInput = z.infer<
  typeof removeStageAttendanceInput
>;
