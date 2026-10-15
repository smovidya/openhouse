import * as t from "drizzle-orm/sqlite-core";
import { defineRelations } from "drizzle-orm";

export const id = {
  id: t
    .text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
};

export const timestamps = {
  createdAt: t
    .integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date()),
  updatedAt: t
    .integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  deletedAt: t.integer("deleted_at", { mode: "timestamp" }),
};

export const users = t.sqliteTable("users", {
  ...id,
  googleId: t.text("google_id").notNull(),
  email: t.text("email").notNull(),
  name: t.text("name").notNull(),
  image: t.text("image"),
  role: t
    .text("role", {
      enum: ["staff", "attendee"],
    })
    .notNull(),
  ...timestamps,
});

export const attendees = t.sqliteTable(
  "attendees",
  {
    ...id,
    qrCodeId: t.text().notNull(),
    userId: t
      .text("user_id")
      .notNull()
      .references(() => users.id),
    title: t.text("title").notNull(),
    firstname: t.text("firstname").notNull(),
    lastname: t.text("lastname").notNull(),
    age: t.integer("age").notNull(),
    residentProvince: t.text("resident_province").notNull(),
    type: t.text("type").notNull(),
    school: t.text("school"),
    surveyResponses: t.text("questions", {
      mode: "json",
    }),
    ...timestamps,
  },
  (table) => [t.index("idx_attendees_qr_code_id").on(table.qrCodeId)],
);

export const staffs = t.sqliteTable(
  "staffs",
  {
    ...id,
    userId: t
      .text("user_id")
      .notNull()
      .references(() => users.id),
    type: t.text("type").notNull(),
    name: t.text("name").notNull(),
    department: t.text("department"),
    phone: t.text("phone").notNull(),
    permission: t.text("permission").notNull(),
    ...timestamps,
  },
  (table) => [t.index("idx_staffs_user_id").on(table.userId)],
);

export const workshops = t.sqliteTable("workshops", {
  ...id,
  title: t.text("title").notNull(),
  hostDepartment: t.text("host_department").notNull(),
  hostDepartimentAbbr: t.text("host_department_abbr").notNull(),
  description: t.text("description").notNull(),
  capacity: t.integer("capacity").notNull(),
  ...timestamps,
});

export const workshopTimeSlots = t.sqliteTable("workshop_time_slots", {
  ...id,
  workshopId: t
    .text("workshop_id")
    .notNull()
    .references(() => workshops.id),
  roundNumber: t.integer("round_number").notNull(),
  date: t.integer("date", { mode: "timestamp" }).notNull(),
  startTime: t.integer("start_time", { mode: "timestamp" }).notNull(),
  endTime: t.integer("end_time", { mode: "timestamp" }).notNull(),
  ...timestamps,
});

export const workshopRegistrations = t.sqliteTable("workshop_registrations", {
  ...id,
  workshopTimeSlotId: t
    .text("workshop_time_slot_id")
    .notNull()
    .references(() => workshopTimeSlots.id),
  attendeeId: t
    .text("attendee_id")
    .notNull()
    .references(() => attendees.id),
  type: t
    .text("type", {
      enum: ["advance", "walk-in"],
    })
    .notNull(),
  ...timestamps,
});

export const checkpoints = t.sqliteTable("checkpoints", {
  ...id,
  name: t.text("name"),
  note: t.text("note"),
  type: t
    .text("type", {
      enum: ["entry", "booth", "reward", "stage", "workshop"],
    })
    .notNull(),
  ...timestamps,
});

export const checkpointLogs = t.sqliteTable("checkpoint_logs", {
  ...id,
  attendeeId: t
    .text("attendee_id")
    .notNull()
    .references(() => attendees.id),
  checkpointId: t
    .text("checkpoint_id")
    .notNull()
    .references(() => checkpoints.id),
  checkerId: t.text("checker_id").references(() => staffs.id),
  ...timestamps,
});

export const rewardRedemptions = t.sqliteTable("reward_redemptions", {
  ...id,
  attendeeId: t
    .text("attendee_id")
    .notNull()
    .references(() => attendees.id),
  checkpointId: t
    .text("checkpoint_id")
    .notNull()
    .references(() => checkpoints.id),
  checkerId: t.text("checker_id").references(() => staffs.id),
  ...timestamps,
});

export const surveyResponses = t.sqliteTable("survey_responses", {
  ...id,
  attendeeId: t
    .text("attendee_id")
    .notNull()
    .references(() => attendees.id),
  answer: t.text("answer", { mode: "json" }).notNull(),
  ...timestamps,
});

export const relations = defineRelations(
  {
    users,
    attendees,
    staffs,
    checkpoints,
    checkpointLogs,
    rewardRedemptions,
    workshops,
    workshopTimeSlots,
    workshopRegistrations,
    surveyResponses,
  },
  (is) => ({
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
  }),
);
