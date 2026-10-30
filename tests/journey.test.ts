import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isHttpError } from "@sveltejs/kit";
import { and, eq, isNull } from "drizzle-orm";
import { getPlatformProxy } from "wrangler";
import { getDb, type Db } from "../src/lib/server/db/index";
import {
  attendees,
  checkpointLogs,
  checkpoints,
  rewardGifts,
  rewardRedemptions,
  staffs,
  users,
  workshops,
  workshopTimeSlots,
  workshopRegistrations,
} from "../src/lib/server/db/tables";
import {
  checkInAttendee,
  getStaffAttendeeProgress,
  listAttendeeCheckpointLogs,
  listBoothHistory,
  removeStageAttendance,
} from "../src/lib/features/checkpoints/service.server";
import {
  getAttendeeProgress,
  getMyProgress,
} from "../src/lib/features/checkpoints/progress.server";
import {
  listRewardRedemptions,
  previewReward,
  redeemReward,
  saveRewardGift,
} from "../src/lib/features/rewards/service.server";
import { checkInWorkshop } from "../src/lib/features/workshops/attendance.server";
import { buildSeedAdminStatements } from "../scripts/seed-admin-sql";

const status = (n: number, message?: string) => (cause: unknown) =>
  isHttpError(cause, n) && (!message || cause.body.message === message);

describe("attendee journey on D1", () => {
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
  let directory: string;
  let db: Db;
  let adminId: string;
  let checkerId: string;

  async function createUser() {
    const id = crypto.randomUUID();
    await db.insert(users).values({
      id,
      googleId: id,
      email: `${id}@example.com`,
      name: "Test",
      role: "attendee",
    });
    return id;
  }
  async function createAttendee() {
    const userId = await createUser();
    const [attendee] = await db
      .insert(attendees)
      .values({
        userId,
        qrCodeId: crypto.randomUUID(),
        title: "Mx",
        firstname: "Journey",
        lastname: "Test",
        age: 18,
        residentProvince: "Bangkok",
        type: "student",
      })
      .returning();
    return attendee;
  }
  type Attendee = Awaited<ReturnType<typeof createAttendee>>;
  async function createStaff(
    permission: (typeof staffs.$inferInsert)["permission"],
  ) {
    const userId = await createUser();
    await db.update(users).set({ role: "staff" }).where(eq(users.id, userId));
    await db.insert(staffs).values({
      userId,
      type: "test",
      name: "Staff",
      phone: "0000000000",
      permission,
    });
    return userId;
  }
  async function seedProgress(
    attendee: Attendee,
    options: {
      departments: number;
      workshops?: number;
      stage?: boolean;
      tcas?: boolean;
      central?: boolean;
    },
  ) {
    const ids = [
      "entry",
      ...(options.tcas === false ? [] : ["tcas"]),
      ...(options.central === false ? [] : ["central"]),
      ...Array.from({ length: options.departments }, (_, i) => `booth-${i}`),
      ...(options.stage ? ["stage"] : []),
    ];
    for (let offset = 0; offset < ids.length; offset += 8) {
      await db.insert(checkpointLogs).values(
        ids.slice(offset, offset + 8).map((checkpointId) => ({
          attendeeId: attendee.id,
          checkpointId,
          checkerId,
        })),
      );
    }
    for (let i = 1; i <= (options.workshops ?? 0); i++)
      await db.insert(checkpointLogs).values({
        attendeeId: attendee.id,
        checkpointId: `workshop-point-${i}`,
        workshopId: `workshop-${i}`,
        attendanceType: "walk-in",
        checkerId,
      });
  }
  const confirm = (
    attendee: Attendee,
    tier: 1 | 2 | 3,
    giftId = `gift-${tier}`,
  ) =>
    redeemReward(db, adminId, {
      qrCodeId: attendee.qrCodeId,
      checkpointId: "reward",
      giftId,
      expectedTier: tier,
    });

  before(async () => {
    directory = await mkdtemp(join(tmpdir(), "openhouse-journey-"));
    const configPath = join(directory, "wrangler.json");
    await writeFile(
      configPath,
      JSON.stringify({
        name: "journey",
        compatibility_date: "2026-10-06",
        d1_databases: [{ binding: "DB", database_name: "journey" }],
      }),
    );
    proxy = await getPlatformProxy<{ DB: D1Database }>({
      configPath,
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
    adminId = await createUser();
    await proxy.env.DB.batch(
      buildSeedAdminStatements({
        userId: adminId,
        name: "Admin",
        phone: "0123456789",
        type: "organizer",
        department: null,
      }).map((s) => proxy.env.DB.prepare(s)),
    );
    checkerId = (
      await db.select().from(staffs).where(eq(staffs.userId, adminId))
    )[0].id;
    const points: Array<typeof checkpoints.$inferInsert> = [
      { id: "entry", type: "entry" },
      { id: "entry-2", type: "entry" },
      { id: "tcas", type: "tcas" },
      { id: "central", type: "central_activity" },
      { id: "stage", type: "stage" },
      { id: "reward", type: "reward" },
      ...Array.from({ length: 18 }, (_, i) => ({
        id: `booth-${i}`,
        type: "booth" as const,
        department: `dept-${i}`,
      })),
      { id: "same-department", type: "booth", department: "dept-0" },
    ];
    for (const point of points) await db.insert(checkpoints).values(point);
    for (const tier of [1, 2, 3] as const)
      await db
        .insert(rewardGifts)
        .values({ id: `gift-${tier}`, name: `Tier ${tier} gift`, tier });
    for (const i of [1, 2]) {
      await db.insert(workshops).values({
        id: `workshop-${i}`,
        slug: `workshop-${i}`,
        title: `Workshop ${i}`,
        hostDepartment: "Physics",
        hostDepartimentAbbr: "PHY",
        description: "Test",
        capacity: 1,
      });
      await db.insert(workshopTimeSlots).values({
        id: `slot-${i}`,
        workshopId: `workshop-${i}`,
        roundNumber: 1,
        startsAt: new Date("2026-10-31T06:00:00Z"),
        endsAt: new Date("2026-10-31T07:00:00Z"),
      });
      await db.insert(checkpoints).values({
        id: `workshop-point-${i}`,
        type: "workshop",
        workshopTimeSlotId: `slot-${i}`,
      });
    }
  });
  after(async () => {
    await proxy?.dispose();
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("gates entry, rejects repeats across entry desks, and counts departments rather than logs", async () => {
    const attendee = await createAttendee();
    await assert.rejects(
      checkInAttendee(db, adminId, {
        qrCodeId: attendee.qrCodeId,
        checkpointId: "booth-0",
      }),
      status(409, "ENTRY_REQUIRED"),
    );
    await checkInAttendee(db, adminId, {
      qrCodeId: attendee.qrCodeId,
      checkpointId: "entry",
    });
    await assert.rejects(
      checkInAttendee(db, adminId, {
        qrCodeId: attendee.qrCodeId,
        checkpointId: "entry-2",
      }),
      status(409, "ALREADY_CHECKED_IN"),
    );
    for (const checkpointId of [
      "booth-0",
      "same-department",
      "tcas",
      "central",
    ])
      await checkInAttendee(db, adminId, {
        qrCodeId: attendee.qrCodeId,
        checkpointId,
      });
    await db.insert(workshopRegistrations).values({
      attendeeId: attendee.id,
      workshopTimeSlotId: "slot-1",
      type: "advance",
    });
    const progress = await getMyProgress(db, attendee.userId);
    assert.equal(progress.counts.departmentCount, 1);
    assert.equal(progress.counts.workshopCount, 0);
    assert.equal(progress.highestEligibleTier, null);
    assert.equal(
      progress.checkpoints.find((p) => p.id === "booth-1")?.completed,
      false,
    );
    assert.equal(
      progress.checkpoints.find((p) => p.id === "booth-0")?.completed,
      true,
    );
  });

  it("enforces all tier boundaries in both preview and the database redemption calculation", async () => {
    const cases: Array<{
      departments: number;
      workshops: number;
      stage?: boolean;
      tcas?: boolean;
      central?: boolean;
      tier: 1 | 2 | 3 | null;
    }> = [
      { departments: 5, workshops: 2, stage: true, tier: null },
      { departments: 6, workshops: 0, tier: 3 },
      { departments: 12, workshops: 0, tier: 3 },
      { departments: 11, workshops: 1, tier: 3 },
      { departments: 12, workshops: 1, tier: 2 },
      { departments: 17, workshops: 2, tier: 2 },
      { departments: 17, workshops: 1, stage: true, tier: 2 },
      { departments: 17, workshops: 2, stage: true, tier: 1 },
      { departments: 17, workshops: 2, stage: true, tcas: false, tier: null },
      {
        departments: 17,
        workshops: 2,
        stage: true,
        central: false,
        tier: null,
      },
    ];
    for (const entry of cases) {
      const attendee = await createAttendee();
      await seedProgress(attendee, entry);
      const preview = await previewReward(db, adminId, {
        qrCodeId: attendee.qrCodeId,
      });
      assert.equal(preview.progress.highestEligibleTier, entry.tier);
      assert.deepEqual(
        preview.gifts.map((gift) => gift.tier),
        entry.tier === null ? [] : [entry.tier],
      );
      if (entry.tier)
        assert.equal(
          (await confirm(attendee, entry.tier)).redemption.tier,
          entry.tier,
        );
      else
        await assert.rejects(
          confirm(attendee, 3),
          status(409, "REWARD_NOT_ELIGIBLE"),
        );
    }
  });

  it("keeps preview read-only and rejects lower-tier gifts and stale confirmations", async () => {
    const attendee = await createAttendee();
    await seedProgress(attendee, { departments: 12, workshops: 1 });
    const before = await db
      .select()
      .from(checkpointLogs)
      .where(eq(checkpointLogs.attendeeId, attendee.id));
    await previewReward(db, adminId, { qrCodeId: attendee.qrCodeId });
    await previewReward(db, adminId, { qrCodeId: attendee.qrCodeId });
    assert.deepEqual(
      await db
        .select()
        .from(checkpointLogs)
        .where(eq(checkpointLogs.attendeeId, attendee.id)),
      before,
    );
    await assert.rejects(
      confirm(attendee, 2, "gift-3"),
      status(409, "GIFT_TIER_MISMATCH"),
    );
    await assert.rejects(confirm(attendee, 3), status(409, "PROGRESS_CHANGED"));
    assert.equal(
      (
        await db
          .select()
          .from(rewardRedemptions)
          .where(eq(rewardRedemptions.attendeeId, attendee.id))
      ).length,
      0,
    );
    assert.equal(
      (
        await db
          .select()
          .from(checkpointLogs)
          .where(eq(checkpointLogs.attendeeId, attendee.id))
      ).length,
      before.length,
    );
  });

  it("permits one concurrent handover and closes other collection and stage removal", async () => {
    const attendee = await createAttendee();
    await seedProgress(attendee, { departments: 6, stage: true });
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () => confirm(attendee, 3)),
    );
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    for (const result of results)
      if (result.status === "rejected")
        assert.ok(status(409, "ALREADY_REDEEMED")(result.reason));
    assert.equal(
      (
        await db
          .select()
          .from(rewardRedemptions)
          .where(eq(rewardRedemptions.attendeeId, attendee.id))
      ).length,
      1,
    );
    const logs = await listAttendeeCheckpointLogs(db, adminId, {
      qrCodeId: attendee.qrCodeId,
      offset: 0,
      limit: 100,
    });
    assert.equal(
      logs.filter((log) => log.checkpointType === "reward").length,
      1,
    );
    for (const checkpointId of ["booth-7", "stage", "entry"])
      await assert.rejects(
        checkInAttendee(db, adminId, {
          qrCodeId: attendee.qrCodeId,
          checkpointId,
        }),
        status(409, "JOURNEY_REDEEMED"),
      );
    await assert.rejects(
      removeStageAttendance(db, adminId, {
        logId: logs.find((log) => log.checkpointType === "stage")!.id,
        reason: "Correction",
      }),
      status(409),
    );
  });

  it("allows workshops after redemption without changing the saved tier, gift, or progress snapshot", async () => {
    const attendee = await createAttendee();
    await seedProgress(attendee, { departments: 17, stage: true });
    const redeemed = await confirm(attendee, 3);
    for (const i of [1, 2])
      await checkInWorkshop(db, adminId, {
        qrCodeId: attendee.qrCodeId,
        workshopTimeSlotId: `slot-${i}`,
        mode: "open",
      });
    const progress = await getMyProgress(db, attendee.userId);
    assert.equal(progress.highestEligibleTier, 1);
    assert.equal(progress.redemption?.tier, 3);
    assert.deepEqual(
      progress.redemption?.progressSnapshot,
      redeemed.redemption.progressSnapshot,
    );
    assert.equal(progress.redemption?.progressSnapshot?.workshopCount, 0);
    assert.equal(progress.canCollectCheckpoints, false);
    assert.equal(progress.canAttendWorkshops, true);
    await assert.rejects(confirm(attendee, 1), status(409, "ALREADY_REDEEMED"));
  });

  it("serializes a tier-changing booth scan against reward confirmation", async () => {
    const attendee = await createAttendee();
    await seedProgress(attendee, { departments: 11, workshops: 1 });
    const [scan, redemption] = await Promise.allSettled([
      checkInAttendee(db, adminId, {
        qrCodeId: attendee.qrCodeId,
        checkpointId: "booth-11",
      }),
      confirm(attendee, 3),
    ]);
    // If scan won, tier 3 confirmation must be stale. If handover won, scan is closed.
    assert.equal(
      [scan, redemption].filter((result) => result.status === "fulfilled")
        .length,
      1,
    );
    if (scan.status === "fulfilled") {
      assert.equal(scan.value.progress.highestEligibleTier, 2);
      assert.ok(
        redemption.status === "rejected" &&
          status(409, "PROGRESS_CHANGED")(redemption.reason),
      );
    } else {
      assert.ok(status(409, "JOURNEY_REDEEMED")(scan.reason));
      assert.ok(
        redemption.status === "fulfilled" &&
          redemption.value.redemption.tier === 3,
      );
    }
  });

  it("audits stage removal, recalculates progress, and allows a corrected attendance", async () => {
    const attendee = await createAttendee();
    await seedProgress(attendee, {
      departments: 17,
      workshops: 2,
      stage: true,
    });
    const [stage] = await db
      .select()
      .from(checkpointLogs)
      .where(
        and(
          eq(checkpointLogs.attendeeId, attendee.id),
          eq(checkpointLogs.checkpointId, "stage"),
        ),
      );
    const removed = await removeStageAttendance(db, adminId, {
      logId: stage.id,
      reason: "Wrong attendee",
    });
    assert.equal(removed.progress.highestEligibleTier, 2);
    const history = await listAttendeeCheckpointLogs(db, adminId, {
      qrCodeId: attendee.qrCodeId,
      offset: 0,
      limit: 100,
    });
    const old = history.find((log) => log.id === stage.id)!;
    assert.ok(old.deletedAt);
    assert.equal(old.removedById, checkerId);
    assert.equal(old.removalReason, "Wrong attendee");
    const fixed = await checkInAttendee(db, adminId, {
      qrCodeId: attendee.qrCodeId,
      checkpointId: "stage",
    });
    assert.equal(fixed.progress.highestEligibleTier, 1);
    assert.notEqual(fixed.log.id, stage.id);
  });

  it("restricts reads to the owning attendee or active staff and rejects inactive QR codes", async () => {
    const attendee = await createAttendee();
    const other = await createAttendee();
    await seedProgress(attendee, { departments: 6 });
    assert.equal(
      (await getMyProgress(db, attendee.userId)).highestEligibleTier,
      3,
    );
    assert.equal(
      (await getMyProgress(db, other.userId)).highestEligibleTier,
      null,
    );
    await assert.rejects(getMyProgress(db, adminId), status(404));
    await assert.rejects(
      getStaffAttendeeProgress(db, other.userId, attendee.qrCodeId),
      status(403),
    );
    await assert.rejects(
      previewReward(db, other.userId, { qrCodeId: attendee.qrCodeId }),
      status(403),
    );
    await db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, attendee.userId));
    await assert.rejects(
      checkInAttendee(db, adminId, {
        qrCodeId: attendee.qrCodeId,
        checkpointId: "booth-8",
      }),
      status(404),
    );
    await assert.rejects(
      getStaffAttendeeProgress(db, adminId, attendee.qrCodeId),
      status(404),
    );
  });

  it("keeps redeemed gift details immutable when an admin edits or disables the gift", async () => {
    const attendee = await createAttendee();
    await seedProgress(attendee, { departments: 6 });
    const gift = await saveRewardGift(db, adminId, {
      name: "Original souvenir",
      tier: 3,
      enabled: true,
    });
    await confirm(attendee, 3, gift.id);
    await saveRewardGift(db, adminId, {
      id: gift.id,
      name: "Replacement",
      tier: 2,
      enabled: false,
    });
    const progress = await getAttendeeProgress(db, attendee.id);
    assert.equal(progress.redemption?.giftName, "Original souvenir");
    assert.equal(progress.redemption?.tier, 3);
    assert.equal(
      (
        await db
          .select()
          .from(rewardRedemptions)
          .where(
            and(
              eq(rewardRedemptions.attendeeId, attendee.id),
              isNull(rewardRedemptions.deletedAt),
            ),
          )
      ).length,
      1,
    );
  });

  it("lists booth check-in history for the staff's own booths only, newest first", async () => {
    const visitor = await createAttendee();
    await seedProgress(visitor, { departments: 2 });
    const page = { offset: 0, limit: 100 };

    // dept-0 staff: booth-0 (and same-department), never booth-1, TCAS, or entry.
    const boothStaff = await createStaff(["boothStaff:dept-0"]);
    const own = await listBoothHistory(db, boothStaff, page);
    const visits = own.filter((row) => row.firstname === "Journey");
    assert.ok(visits.some((row) => row.checkpointId === "booth-0"));
    assert.ok(
      own.every((row) =>
        ["booth-0", "same-department"].includes(row.checkpointId),
      ),
    );
    assert.deepEqual(
      await listBoothHistory(db, boothStaff, {
        ...page,
        checkpointId: "booth-1",
      }),
      [],
    );
    const [row] = visits;
    assert.equal(row.age, 18);
    assert.equal(row.type, "student");

    // Admins see every booth-like checkpoint, newest first, but not entry or reward handovers.
    const all = await listBoothHistory(db, adminId, page);
    assert.ok(all.some((log) => log.checkpointId === "tcas"));
    assert.ok(
      all.every((log) => !["entry", "reward"].includes(log.checkpointId)),
    );
    const times = all.map((log) => log.createdAt?.getTime() ?? 0);
    assert.deepEqual(
      times,
      [...times].sort((a, b) => b - a),
    );
  });

  it("lists reward redemptions for activity staff only, newest first", async () => {
    const attendee = await createAttendee();
    await seedProgress(attendee, { departments: 6 });
    await confirm(attendee, 3);
    const page = { offset: 0, limit: 100 };

    const redemptions = await listRewardRedemptions(db, adminId, page);
    const mine = redemptions.find(
      (row) => row.id && row.tier === 3 && row.giftName === "Tier 3 gift",
    );
    assert.ok(mine);
    assert.equal(mine.age, 18);
    const times = redemptions.map((row) => row.createdAt?.getTime() ?? 0);
    assert.deepEqual(
      times,
      [...times].sort((a, b) => b - a),
    );

    const workshopStaff = await createStaff(["workshopStaff"]);
    await assert.rejects(
      listRewardRedemptions(db, workshopStaff, page),
      status(403),
    );
  });
});
