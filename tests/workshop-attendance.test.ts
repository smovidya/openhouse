import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";
import { isHttpError } from "@sveltejs/kit";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, tables, type Db } from "../src/lib/server/db/index";
import {
  checkInWorkshop,
  getWorkshopAttendanceStats,
  listWorkshopAttendance,
  setWorkshopAttendance,
} from "../src/lib/features/workshops/attendance.server";

const profile = {
  type: "student",
  name: "Workshop Staff",
  phone: "0123456789",
  department: null,
};
describe("workshop attendance", () => {
  let directory: string;
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
  let db: Db;
  let staffId: string;
  let workshop: typeof tables.workshops.$inferSelect;
  let slot1: typeof tables.workshopTimeSlots.$inferSelect;
  let slot2: typeof tables.workshopTimeSlots.$inferSelect;
  let entry: typeof tables.checkpoints.$inferSelect;
  before(async () => {
    directory = await mkdtemp(join(tmpdir(), "openhouse-attendance-"));
    const config = join(directory, "wrangler.json");
    await writeFile(
      config,
      JSON.stringify({
        name: "attendance-test",
        compatibility_date: "2026-10-06",
        d1_databases: [{ binding: "DB", database_name: "attendance-test" }],
      }),
    );
    proxy = await getPlatformProxy({
      configPath: config,
      persist: false,
      remoteBindings: false,
      envFiles: [],
    });
    for (const migration of (await readdir("drizzle")).sort()) {
      const source = await readFile(
        join("drizzle", migration, "migration.sql"),
        "utf8",
      );
      for (const statement of source
        .split("--> statement-breakpoint")
        .filter((s) => s.trim()))
        await proxy.env.DB.prepare(statement).run();
    }
    db = getDb(proxy.env.DB);
    const [u] = await db
      .insert(tables.users)
      .values({
        googleId: crypto.randomUUID(),
        email: "staff@example.com",
        name: "Staff",
        role: "staff",
      })
      .returning();
    staffId = u.id;
    await db
      .insert(tables.staffs)
      .values({ userId: u.id, ...profile, permission: ["workshopStaff"] });
    [entry] = await db
      .insert(tables.checkpoints)
      .values({ type: "entry", name: "Entry" })
      .returning();
    [workshop] = await db
      .insert(tables.workshops)
      .values({
        slug: crypto.randomUUID(),
        title: "Test",
        hostDepartment: "A",
        hostDepartimentAbbr: "A",
        description: "Test",
        capacity: 1,
      })
      .returning();
    [slot1, slot2] = await db
      .insert(tables.workshopTimeSlots)
      .values([
        {
          workshopId: workshop.id,
          roundNumber: 1,
          startsAt: new Date("2030-01-01T00:00:00Z"),
          endsAt: new Date("2030-01-01T01:00:00Z"),
        },
        {
          workshopId: workshop.id,
          roundNumber: 2,
          startsAt: new Date("2030-01-02T00:00:00Z"),
          endsAt: new Date("2030-01-02T01:00:00Z"),
        },
      ])
      .returning();
    await db.insert(tables.checkpoints).values([
      { type: "workshop", workshopTimeSlotId: slot1.id, name: "Round 1" },
      { type: "workshop", workshopTimeSlotId: slot2.id, name: "Round 2" },
    ]);
  });
  beforeEach(async () => {
    await db
      .update(tables.checkpointLogs)
      .set({ deletedAt: new Date() })
      .where(eq(tables.checkpointLogs.workshopId, workshop.id));
    await db
      .update(tables.workshopRegistrations)
      .set({ deletedAt: new Date() });
  });
  after(async () => {
    await proxy?.dispose();
    if (directory) await rm(directory, { recursive: true, force: true });
  });
  async function attendee(name: string) {
    const [u] = await db
      .insert(tables.users)
      .values({
        googleId: crypto.randomUUID(),
        email: `${name}@example.com`,
        name,
        role: "attendee",
      })
      .returning();
    const [a] = await db
      .insert(tables.attendees)
      .values({
        userId: u.id,
        qrCodeId: crypto.randomUUID(),
        title: "Mx",
        firstname: name,
        lastname: "Test",
        age: 18,
        residentProvince: "Bangkok",
        type: "student",
      })
      .returning();
    await db
      .insert(tables.checkpointLogs)
      .values({ attendeeId: a.id, checkpointId: entry.id });
    return a;
  }
  it("gates entry, admits open walk-ins over capacity, reports pending bookings and soft removal", async () => {
    const a = await attendee("Open");
    const result = await checkInWorkshop(db, staffId, {
      workshopTimeSlotId: slot1.id,
      qrCodeId: a.qrCodeId,
      mode: "open",
    });
    assert.equal(result.log.attendanceType, "walk-in");
    const second = await attendee("Overflow");
    await checkInWorkshop(db, staffId, {
      workshopTimeSlotId: slot1.id,
      qrCodeId: second.qrCodeId,
      mode: "open",
    });
    const stats = await getWorkshopAttendanceStats(db, staffId, {
      workshopTimeSlotId: slot1.id,
    });
    assert.equal(stats.totalAttendance, 2);
    assert.equal(stats.overCapacity, 1);
    assert.equal(stats.walkInArrivals, 2);
    const removed = await setWorkshopAttendance(db, staffId, {
      workshopTimeSlotId: slot1.id,
      attendeeId: a.id,
      present: false,
      mode: "open",
      reason: "Correction",
    });
    assert.ok("removed" in removed && removed.removed);
    const statsAfter = await getWorkshopAttendanceStats(db, staffId, {
      workshopTimeSlotId: slot1.id,
    });
    assert.equal(statsAfter.totalAttendance, 1);
  });
  it("requires exact advance booking and blocks another round of the same workshop", async () => {
    const a = await attendee("Booked");
    await db.insert(tables.workshopRegistrations).values({
      attendeeId: a.id,
      workshopTimeSlotId: slot1.id,
      type: "advance",
    });
    const first = await checkInWorkshop(db, staffId, {
      workshopTimeSlotId: slot1.id,
      qrCodeId: a.qrCodeId,
      mode: "advance",
    });
    assert.equal(first.log.attendanceType, "advance");
    await assert.rejects(() =>
      checkInWorkshop(db, staffId, {
        workshopTimeSlotId: slot2.id,
        qrCodeId: a.qrCodeId,
        mode: "open",
      }),
    );
  });
  it("lists booked pending attendees and rejects workshop-only actor without entry", async () => {
    const a = await attendee("Pending");
    await db.insert(tables.workshopRegistrations).values({
      attendeeId: a.id,
      workshopTimeSlotId: slot2.id,
      type: "advance",
    });
    const roster = await listWorkshopAttendance(db, staffId, {
      workshopTimeSlotId: slot2.id,
    });
    const row = roster.roster.find((r) => r.attendee.id === a.id);
    assert.equal(row?.pending, true);
    const b = await attendee("NoEntry");
    await db
      .delete(tables.checkpointLogs)
      .where(eq(tables.checkpointLogs.attendeeId, b.id));
    await assert.rejects(() =>
      checkInWorkshop(db, staffId, {
        workshopTimeSlotId: slot2.id,
        qrCodeId: b.qrCodeId,
        mode: "open",
      }),
    );
  });

  const conflict = (message: string) => (cause: unknown) =>
    isHttpError(cause, 409) && cause.body.message === message;

  it("rejects missing entry from both scan and manual paths without creating attendance", async () => {
    const a = await attendee("MissingEntry");
    await db
      .delete(tables.checkpointLogs)
      .where(eq(tables.checkpointLogs.attendeeId, a.id));
    await assert.rejects(
      checkInWorkshop(db, staffId, {
        workshopTimeSlotId: slot2.id,
        qrCodeId: a.qrCodeId,
        mode: "open",
      }),
      conflict("ENTRY_REQUIRED"),
    );
    await assert.rejects(
      setWorkshopAttendance(db, staffId, {
        workshopTimeSlotId: slot2.id,
        attendeeId: a.id,
        present: true,
        mode: "open",
      }),
      conflict("ENTRY_REQUIRED"),
    );
    assert.equal(
      (
        await db
          .select()
          .from(tables.checkpointLogs)
          .where(eq(tables.checkpointLogs.attendeeId, a.id))
      ).length,
      0,
    );
  });

  it("requires the exact advance round and preserves booking and audit on untick and re-add", async () => {
    const a = await attendee("AdvanceUndo");
    const [booking] = await db
      .insert(tables.workshopRegistrations)
      .values({
        attendeeId: a.id,
        workshopTimeSlotId: slot1.id,
        type: "advance",
      })
      .returning();
    await assert.rejects(
      checkInWorkshop(db, staffId, {
        workshopTimeSlotId: slot2.id,
        qrCodeId: a.qrCodeId,
        mode: "advance",
      }),
      conflict("ADVANCE_REGISTRATION_REQUIRED"),
    );
    const first = await checkInWorkshop(db, staffId, {
      workshopTimeSlotId: slot1.id,
      qrCodeId: a.qrCodeId,
      mode: "advance",
    });
    const [staff] = await db
      .select()
      .from(tables.staffs)
      .where(eq(tables.staffs.userId, staffId));
    assert.equal(first.log.checkerId, staff.id);
    await assert.rejects(
      checkInWorkshop(db, staffId, {
        workshopTimeSlotId: slot1.id,
        qrCodeId: a.qrCodeId,
        mode: "open",
      }),
      conflict("ALREADY_CHECKED_IN"),
    );
    await setWorkshopAttendance(db, staffId, {
      workshopTimeSlotId: slot1.id,
      attendeeId: a.id,
      present: false,
      mode: "advance",
      reason: "Wrong check-in",
    });
    const [old] = await db
      .select()
      .from(tables.checkpointLogs)
      .where(eq(tables.checkpointLogs.id, first.log.id));
    assert.ok(old.deletedAt);
    assert.equal(old.removedById, staff.id);
    assert.equal(old.removalReason, "Wrong check-in");
    assert.equal(
      (
        await db
          .select()
          .from(tables.workshopRegistrations)
          .where(eq(tables.workshopRegistrations.id, booking.id))
      )[0].deletedAt,
      null,
    );
    const stats = await getWorkshopAttendanceStats(db, staffId, {
      workshopTimeSlotId: slot1.id,
    });
    assert.equal(stats.pendingAdvanceArrivals, 1);
    assert.equal(stats.totalAttendance, 0);
    const again = await setWorkshopAttendance(db, staffId, {
      workshopTimeSlotId: slot1.id,
      attendeeId: a.id,
      present: true,
      mode: "advance",
    });
    assert.ok("log" in again && again.log.id !== first.log.id);
  });

  it("admits booked and unbooked people in open mode even when bookings and arrivals fill capacity", async () => {
    const booked = await attendee("OpenBooked");
    await db.insert(tables.workshopRegistrations).values({
      attendeeId: booked.id,
      workshopTimeSlotId: slot2.id,
      type: "advance",
    });
    for (const name of ["WalkOne", "WalkTwo"]) {
      const a = await attendee(name);
      await checkInWorkshop(db, staffId, {
        workshopTimeSlotId: slot2.id,
        qrCodeId: a.qrCodeId,
        mode: "open",
      });
    }
    const pending = await getWorkshopAttendanceStats(db, staffId, {
      workshopTimeSlotId: slot2.id,
    });
    assert.equal(pending.pendingAdvanceArrivals, 1);
    await checkInWorkshop(db, staffId, {
      workshopTimeSlotId: slot2.id,
      qrCodeId: booked.qrCodeId,
      mode: "open",
    });
    const stats = await getWorkshopAttendanceStats(db, staffId, {
      workshopTimeSlotId: slot2.id,
    });
    assert.equal(stats.advanceBookings, 1);
    assert.equal(stats.advanceArrivals, 1);
    assert.equal(stats.pendingAdvanceArrivals, 0);
    assert.equal(stats.walkInArrivals, 2);
    assert.equal(stats.totalAttendance, 3);
    assert.equal(stats.overCapacity, 2);
    assert.deepEqual(stats.workshopTotals, {
      attendance: 3,
      uniqueAttendees: 3,
    });
    assert.deepEqual(stats.eventTotals, { attendance: 3, uniqueAttendees: 3 });
    const roster = await listWorkshopAttendance(db, staffId, {
      workshopTimeSlotId: slot2.id,
    });
    assert.equal(roster.roster.length, 3);
    assert.ok(
      roster.roster.every((row) => row.present && row.log?.id && !row.pending),
    );
  });

  it("serializes cross-round repeats and permits only one attendance", async () => {
    const a = await attendee("RaceRound");
    const results = await Promise.allSettled(
      [slot1, slot2].map((slot) =>
        checkInWorkshop(db, staffId, {
          workshopTimeSlotId: slot.id,
          qrCodeId: a.qrCodeId,
          mode: "open",
        }),
      ),
    );
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    for (const result of results)
      if (result.status === "rejected")
        assert.ok(conflict("WORKSHOP_ALREADY_ATTENDED")(result.reason));
    const logs = await db
      .select()
      .from(tables.checkpointLogs)
      .where(
        and(
          eq(tables.checkpointLogs.attendeeId, a.id),
          eq(tables.checkpointLogs.workshopId, workshop.id),
          isNull(tables.checkpointLogs.deletedAt),
        ),
      );
    assert.equal(logs.length, 1);
  });

  it("holds advance capacity under concurrent check-in while leaving open admission available", async () => {
    const people = [await attendee("CapacityA"), await attendee("CapacityB")];
    for (const person of people)
      await db.insert(tables.workshopRegistrations).values({
        attendeeId: person.id,
        workshopTimeSlotId: slot1.id,
        type: "advance",
      });
    const results = await Promise.allSettled(
      people.map((person) =>
        checkInWorkshop(db, staffId, {
          workshopTimeSlotId: slot1.id,
          qrCodeId: person.qrCodeId,
          mode: "advance",
        }),
      ),
    );
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    const loser = results.findIndex((result) => result.status === "rejected");
    const failed = results[loser];
    assert.ok(
      failed.status === "rejected" && conflict("WORKSHOP_FULL")(failed.reason),
    );
    await checkInWorkshop(db, staffId, {
      workshopTimeSlotId: slot1.id,
      qrCodeId: people[loser].qrCodeId,
      mode: "open",
    });
    assert.equal(
      (
        await getWorkshopAttendanceStats(db, staffId, {
          workshopTimeSlotId: slot1.id,
        })
      ).overCapacity,
      1,
    );
  });

  it("denies booth-only staff workshop reads and writes", async () => {
    const [user] = await db
      .insert(tables.users)
      .values({
        googleId: crypto.randomUUID(),
        email: "booth@example.com",
        name: "Booth",
        role: "staff",
      })
      .returning();
    await db
      .insert(tables.staffs)
      .values({ userId: user.id, ...profile, permission: ["boothStaff:all"] });
    const a = await attendee("Denied");
    const denied = (cause: unknown) => isHttpError(cause, 403);
    await assert.rejects(
      listWorkshopAttendance(db, user.id, { workshopTimeSlotId: slot1.id }),
      denied,
    );
    await assert.rejects(
      getWorkshopAttendanceStats(db, user.id, { workshopTimeSlotId: slot1.id }),
      denied,
    );
    await assert.rejects(
      checkInWorkshop(db, user.id, {
        workshopTimeSlotId: slot1.id,
        qrCodeId: a.qrCodeId,
        mode: "open",
      }),
      denied,
    );
    await assert.rejects(
      setWorkshopAttendance(db, user.id, {
        workshopTimeSlotId: slot1.id,
        attendeeId: a.id,
        present: true,
        mode: "open",
      }),
      denied,
    );
  });
});
