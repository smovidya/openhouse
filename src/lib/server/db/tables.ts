import * as t from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import type { StaffPermission } from "#lib/features/staff/permissions.ts";

const id = {
  id: t
    .text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
};

const timestamps = {
  createdAt: t
    .integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date()),
  updatedAt: t
    .integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  deletedAt: t.integer("deleted_at", { mode: "timestamp" }),
};

export type AttendeeSurveyResponses = {
  reason: string;
  expectation: string;
  newsSources: string[];
  visitIntent: string;
  major1: string;
  major2: string;
  major3: string;
};

export const users = t.sqliteTable(
  "users",
  {
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
  },
  (table) => [t.uniqueIndex("users_google_id_unique").on(table.googleId)],
);

export const attendees = t.sqliteTable(
  "attendees",
  {
    ...id,
    qrCodeId: t.text().notNull().unique(),
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
    prefixOther: t.text("prefix_other"),
    emergencyPhone: t.text("emergency_phone"),
    emergencyName: t.text("emergency_name"),
    specialNeed: t.text("special_need"),
    surveyResponses: t
      .text("questions", {
        mode: "json",
      })
      .$type<AttendeeSurveyResponses>(),
    ...timestamps,
  },
  (table) => [t.uniqueIndex("idx_attendees_qr_code_id").on(table.qrCodeId)],
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
    permission: t
      .text("permission", { mode: "json" })
      .$type<StaffPermission[]>()
      .notNull(),
    ...timestamps,
  },
  (table) => [t.uniqueIndex("staffs_user_id_unique").on(table.userId)],
);

export const inviteCodes = t.sqliteTable("invite_codes", {
  ...id,
  codeHash: t.text("code_hash").notNull().unique(),
  permission: t
    .text("permission", { mode: "json" })
    .$type<StaffPermission[]>()
    .notNull(),
  ...timestamps,
});

export const workshops = t.sqliteTable("workshops", {
  ...id,
  slug: t.text("slug").notNull().unique(),
  title: t.text("title").notNull(),
  hostDepartment: t.text("host_department").notNull(),
  hostDepartimentAbbr: t.text("host_department_abbr").notNull(),
  description: t.text("description").notNull(),
  capacity: t.integer("capacity").notNull(),
  ...timestamps,
});

export const workshopTimeSlots = t.sqliteTable(
  "workshop_time_slots",
  {
    ...id,
    workshopId: t
      .text("workshop_id")
      .notNull()
      .references(() => workshops.id),
    roundNumber: t.integer("round_number").notNull(),
    startsAt: t.integer("starts_at", { mode: "timestamp" }).notNull(),
    endsAt: t.integer("ends_at", { mode: "timestamp" }).notNull(),
    ...timestamps,
  },
  (table) => [
    t
      .uniqueIndex("workshop_time_slots_workshop_id_round_number_unique")
      .on(table.workshopId, table.roundNumber),
  ],
);

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
  // Required for booth checkpoints when granting department-scoped access.
  department: t.text("department"),
  type: t
    .text("type", {
      enum: ["entry", "booth", "reward", "stage", "workshop"],
    })
    .notNull(),
  ...timestamps,
});

export const checkpointLogs = t.sqliteTable(
  "checkpoint_logs",
  {
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
  },
  (table) => [
    t
      .uniqueIndex("checkpoint_logs_active_attendee_checkpoint_unique")
      .on(table.attendeeId, table.checkpointId)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

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

export const tables = {
  users,
  attendees,
  staffs,
  inviteCodes,
  workshops,
  workshopTimeSlots,
  workshopRegistrations,
  checkpoints,
  checkpointLogs,
  rewardRedemptions,
  surveyResponses,
};
