import { defineRelations } from "drizzle-orm";
import { tables } from "./tables";

export const relations = defineRelations(tables, (is) => ({
  users: {
    attendee: is.one.attendees({
      from: is.users.id,
      to: is.attendees.userId,
    }),
    staff: is.one.staffs({
      from: is.users.id,
      to: is.staffs.userId,
    }),
  },
  attendees: {
    user: is.one.users({
      from: is.attendees.userId,
      to: is.users.id,
    }),
    workshopRegistrations: is.many.workshopRegistrations({
      from: is.attendees.id,
      to: is.workshopRegistrations.attendeeId,
    }),
    checkpointLogs: is.many.checkpointLogs({
      from: is.attendees.id,
      to: is.checkpointLogs.attendeeId,
    }),
    rewardRedemptions: is.many.rewardRedemptions({
      from: is.attendees.id,
      to: is.rewardRedemptions.attendeeId,
    }),
  },
  staffs: {
    user: is.one.users({
      from: is.staffs.userId,
      to: is.users.id,
    }),
  },
  workshops: {
    timeSlots: is.many.workshopTimeSlots({
      from: is.workshops.id,
      to: is.workshopTimeSlots.workshopId,
    }),
  },
  workshopTimeSlots: {
    workshop: is.one.workshops({
      from: is.workshopTimeSlots.workshopId,
      to: is.workshops.id,
    }),
    registrations: is.many.workshopRegistrations({
      from: is.workshopTimeSlots.id,
      to: is.workshopRegistrations.workshopTimeSlotId,
    }),
  },
  workshopRegistrations: {
    timeSlot: is.one.workshopTimeSlots({
      from: is.workshopRegistrations.workshopTimeSlotId,
      to: is.workshopTimeSlots.id,
    }),
    attendee: is.one.attendees({
      from: is.workshopRegistrations.attendeeId,
      to: is.attendees.id,
    }),
  },
  checkpoints: {
    logs: is.many.checkpointLogs({
      from: is.checkpoints.id,
      to: is.checkpointLogs.checkpointId,
    }),
    rewardRedemptions: is.many.rewardRedemptions({
      from: is.checkpoints.id,
      to: is.rewardRedemptions.checkpointId,
    }),
  },
  checkpointLogs: {
    attendee: is.one.attendees({
      from: is.checkpointLogs.attendeeId,
      to: is.attendees.id,
    }),
    checkpoint: is.one.checkpoints({
      from: is.checkpointLogs.checkpointId,
      to: is.checkpoints.id,
    }),
    checker: is.one.staffs({
      from: is.checkpointLogs.checkerId,
      to: is.staffs.id,
    }),
  },
  rewardRedemptions: {
    attendee: is.one.attendees({
      from: is.rewardRedemptions.attendeeId,
      to: is.attendees.id,
    }),
    checkpoint: is.one.checkpoints({
      from: is.rewardRedemptions.checkpointId,
      to: is.checkpoints.id,
    }),
    checker: is.one.staffs({
      from: is.rewardRedemptions.checkerId,
      to: is.staffs.id,
    }),
  },
  surveyResponses: {
    attendee: is.one.attendees({
      from: is.surveyResponses.attendeeId,
      to: is.attendees.id,
    }),
  },
}));
