import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isHttpError } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { getPlatformProxy } from "wrangler";
import { getDb, type Db } from "../src/lib/server/db/index";
import {
  attendees,
  checkpointLogs,
  checkpoints,
  inviteCodes,
  staffs,
  users,
} from "../src/lib/server/db/tables";
import { findSessionUser } from "../src/lib/features/auth/service.server";
import {
  requirePermission,
  requireStaff,
} from "../src/lib/features/auth/guards.server";
import {
  canScanCheckpoint,
  hasPermission,
  staffPermission,
  type StaffPermission,
} from "../src/lib/features/staff/permissions";
import { enrollStaffInput } from "../src/lib/features/staff/schemas";
import {
  createInviteCode,
  disableInviteCode,
  enrollStaff,
  getStaffProfile,
  listBoothDepartments,
  listInviteCodes,
  redeemInviteCode,
} from "../src/lib/features/staff/service.server";
import {
  checkInAttendee,
  listScannableCheckpoints,
} from "../src/lib/features/checkpoints/service.server";
import { buildSeedAdminStatements } from "../scripts/seed-admin-sql";

const isStatus = (status: number) => (cause: unknown) =>
  isHttpError(cause, status);
const profile = {
  name: "Staff Person",
  phone: "0123456789",
  type: "student",
  department: null,
};

it("validates permission names and handles wildcard/admin access without prefix matching", () => {
  for (const permission of [
    "admin",
    "boothStaff:all",
    "boothStaff:physics",
    "workshopStaff",
    "activityStaff",
  ]) {
    assert.equal(staffPermission.safeParse(permission).success, true);
  }
  for (const permission of [
    "staff",
    "boothStaff:",
    "boothStaff:*",
    "boothStaff:Physics",
    "admin:all",
    "boothStaff:physics:admin",
  ]) {
    assert.equal(staffPermission.safeParse(permission).success, false);
  }
  assert.equal(
    hasPermission(["boothStaff:physics"], "boothStaff:physics-2"),
    false,
  );
  assert.equal(hasPermission(["boothStaff:physics"], "boothStaff:all"), false);
  assert.equal(hasPermission(["boothStaff:all"], "workshopStaff"), false);
  assert.equal(hasPermission(["admin"], "workshopStaff"), true);
  assert.equal(
    canScanCheckpoint(["boothStaff:physics"], {
      type: "booth",
      department: null,
    }),
    false,
  );
  assert.equal(
    enrollStaffInput.safeParse({
      ...profile,
      code: "valid-code",
      permission: ["admin"],
    }).success,
    false,
  );
});

describe("staff enrollment and checkpoint authorization on D1", () => {
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
  let directory: string;
  let db: Db;
  let adminId: string;
  let qrCodeId: string;

  async function createUser() {
    const id = crypto.randomUUID();
    await db.insert(users).values({
      id,
      googleId: id,
      email: `${id}@example.com`,
      name: "User",
      role: "attendee",
    });
    return id;
  }

  async function enroll(permission: StaffPermission[]) {
    const id = await createUser();
    const invite = await createInviteCode(db, adminId, permission);
    const user = await enrollStaff(db, id, { ...profile, code: invite.code });
    return { id, user, invite };
  }

  before(async () => {
    directory = await mkdtemp(join(tmpdir(), "openhouse26-staff-test-"));
    const configPath = join(directory, "wrangler.json");
    await writeFile(
      configPath,
      JSON.stringify({
        name: "staff-test",
        compatibility_date: "2026-10-06",
        d1_databases: [{ binding: "DB", database_name: "staff-test" }],
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
        .filter((s) => s.trim())) {
        await proxy.env.DB.prepare(statement).run();
      }
    }
    db = getDb(proxy.env.DB);
    adminId = await createUser();
    await proxy.env.DB.batch(
      buildSeedAdminStatements({ ...profile, userId: adminId }).map(
        (statement) => proxy.env.DB.prepare(statement),
      ),
    );
    const attendeeUserId = await createUser();
    qrCodeId = crypto.randomUUID();
    await db.insert(attendees).values({
      userId: attendeeUserId,
      qrCodeId,
      title: "Mx",
      firstname: "Test",
      lastname: "Attendee",
      age: 18,
      residentProvince: "Bangkok",
      type: "student",
    });
    await db.insert(checkpoints).values([
      {
        id: "physics",
        type: "booth",
        department: "physics",
        name: "Physics booth",
      },
      {
        id: "chemistry",
        type: "booth",
        department: "chemistry",
        name: "Chemistry booth",
      },
      { id: "workshop-1", type: "workshop" },
      { id: "workshop-2", type: "workshop" },
      { id: "entry", type: "entry" },
      { id: "stage", type: "stage" },
      { id: "reward", type: "reward" },
      {
        id: "disabled",
        type: "booth",
        department: "disabled",
        deletedAt: new Date(),
      },
    ]);
  });

  after(async () => {
    await proxy?.dispose();
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("seeds the first admin, safely retries, and refuses to seed a second", async () => {
    const admin = await findSessionUser(db, adminId);
    assert.equal(requirePermission(admin, "admin").id, adminId);
    await proxy.env.DB.batch(
      buildSeedAdminStatements({ ...profile, userId: adminId }).map(
        (statement) => proxy.env.DB.prepare(statement),
      ),
    );
    const other = await createUser();
    const result = await proxy.env.DB.batch(
      buildSeedAdminStatements({
        ...profile,
        userId: other,
        name: "O'Brien; SELECT 1; --",
      }).map((statement) => proxy.env.DB.prepare(statement)),
    );
    assert.equal(result.at(-1)?.results.length, 0);
    assert.equal((await findSessionUser(db, other))?.role, "attendee");
  });

  it("reuses an invite across accounts, preserves attendee records, and exposes safe permissions", async () => {
    const invite = await createInviteCode(db, adminId, ["boothStaff:physics"]);
    const [attendee] = await db
      .select()
      .from(attendees)
      .where(eq(attendees.qrCodeId, qrCodeId));
    for (const id of [attendee.userId, await createUser()]) {
      const user = await enrollStaff(db, id, { ...profile, code: invite.code });
      assert.equal(user.role, "staff");
      assert.deepEqual(user.staff.permission, ["boothStaff:physics"]);
      assert.equal("code" in user.staff, false);
    }
    assert.equal(
      (await db.select().from(attendees).where(eq(attendees.id, attendee.id)))
        .length,
      1,
    );
    const [stored] = await db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.id, invite.id));
    assert.notEqual(stored.codeHash, invite.code);
    assert.equal(stored.codeHash.length, 64);
  });

  it("adds permissions concurrently and deduplicates repeated redemptions", async () => {
    const { id } = await enroll(["boothStaff:physics"]);
    const workshop = await createInviteCode(db, adminId, ["workshopStaff"]);
    const activity = await createInviteCode(db, adminId, ["activityStaff"]);
    await Promise.all([
      redeemInviteCode(db, id, workshop.code),
      redeemInviteCode(db, id, activity.code),
    ]);
    await redeemInviteCode(db, id, workshop.code);
    assert.deepEqual(
      (await findSessionUser(db, id))?.staff?.permission.slice().sort(),
      ["activityStaff", "boothStaff:physics", "workshopStaff"],
    );
    assert.equal(
      (await db.select().from(staffs).where(eq(staffs.userId, id))).length,
      1,
    );
  });

  it("keeps one staff record during concurrent first enrollments", async () => {
    const id = await createUser();
    const physics = await createInviteCode(db, adminId, ["boothStaff:physics"]);
    const workshop = await createInviteCode(db, adminId, ["workshopStaff"]);
    await Promise.all(
      [physics, workshop].map((invite) =>
        enrollStaff(db, id, { ...profile, code: invite.code }),
      ),
    );
    assert.deepEqual(
      (await findSessionUser(db, id))?.staff?.permission.slice().sort(),
      ["boothStaff:physics", "workshopStaff"],
    );
    assert.equal(
      (await db.select().from(staffs).where(eq(staffs.userId, id))).length,
      1,
    );
  });

  it("disables future use without revoking existing grants, and allows admin invites", async () => {
    const { id, invite } = await enroll(["boothStaff:physics"]);
    await disableInviteCode(db, adminId, invite.id);
    await assert.rejects(
      enrollStaff(db, await createUser(), { ...profile, code: invite.code }),
      isStatus(400),
    );
    assert.equal(
      requirePermission(await findSessionUser(db, id), "boothStaff:physics").id,
      id,
    );
    const elevated = await createInviteCode(db, adminId, ["admin"]);
    await redeemInviteCode(db, id, elevated.code);
    assert.equal(
      requirePermission(await findSessionUser(db, id), "admin").id,
      id,
    );
  });

  it("restricts invite management to active admins and uses known booth departments", async () => {
    const { id } = await enroll(["boothStaff:all"]);
    await assert.rejects(createInviteCode(db, id, ["admin"]), isStatus(403));
    await assert.rejects(
      listInviteCodes(db, id, { offset: 0, limit: 50 }),
      isStatus(403),
    );
    const code = await createInviteCode(db, adminId, ["activityStaff"]);
    await assert.rejects(disableInviteCode(db, id, code.id), isStatus(403));
    await assert.rejects(
      createInviteCode(db, adminId, ["boothStaff:unknown"]),
      isStatus(400),
    );
    assert.deepEqual(await listBoothDepartments(db, id), [
      "chemistry",
      "physics",
    ]);
    const listed = await listInviteCodes(db, adminId, {
      offset: 0,
      limit: 100,
    });
    assert.ok(listed.length);
    assert.ok(
      listed.every((item) => !("codeHash" in item) && !("code" in item)),
    );
  });

  it("denies invalid codes, inactive staff, and inactive users without granting access", async () => {
    const id = await createUser();
    await assert.rejects(
      enrollStaff(db, id, { ...profile, code: "not-an-invite" }),
      isStatus(400),
    );
    assert.equal((await findSessionUser(db, id))?.staff, null);
    const disabled = await enroll(["boothStaff:physics"]);
    const extra = await createInviteCode(db, adminId, ["admin"]);
    await db
      .update(staffs)
      .set({ deletedAt: new Date() })
      .where(eq(staffs.userId, disabled.id));
    await assert.rejects(
      enrollStaff(db, disabled.id, { ...profile, code: extra.code }),
      isStatus(403),
    );
    const disabledSession = await findSessionUser(db, disabled.id);
    assert.throws(() => requireStaff(disabledSession), isStatus(403));
    await db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, id));
    await assert.rejects(
      enrollStaff(db, id, { ...profile, code: extra.code }),
      isStatus(401),
    );
    assert.equal(await getStaffProfile(db, disabled.id), null);
  });

  it("enforces the same permission matrix for listing and scanning checkpoints", async () => {
    const cases: Array<[StaffPermission[], string[]]> = [
      [["boothStaff:physics"], ["physics"]],
      [["boothStaff:all"], ["chemistry", "physics"]],
      [["workshopStaff"], ["workshop-1", "workshop-2"]],
      [["activityStaff"], ["entry", "reward", "stage"]],
      [
        ["admin"],
        [
          "chemistry",
          "entry",
          "physics",
          "reward",
          "stage",
          "workshop-1",
          "workshop-2",
        ],
      ],
    ];
    const all = [
      "chemistry",
      "entry",
      "physics",
      "reward",
      "stage",
      "workshop-1",
      "workshop-2",
    ];
    for (const [permission, allowed] of cases) {
      const { id } = await enroll(permission);
      const listed = await listScannableCheckpoints(db, id, {
        offset: 0,
        limit: 100,
      });
      assert.deepEqual(
        listed.map((row) => row.id),
        allowed,
      );
      for (const checkpointId of all) {
        if (allowed.includes(checkpointId))
          await checkInAttendee(db, id, { qrCodeId, checkpointId });
        else
          await assert.rejects(
            checkInAttendee(db, id, { qrCodeId, checkpointId }),
            isStatus(403),
          );
      }
      await assert.rejects(
        checkInAttendee(db, id, { qrCodeId, checkpointId: "disabled" }),
        isStatus(404),
      );
    }
  });

  it("makes concurrent repeat scans idempotent and records the trusted checker", async () => {
    const { id, user } = await enroll(["boothStaff:physics"]);
    const [attendee] = await db
      .select()
      .from(attendees)
      .where(eq(attendees.qrCodeId, qrCodeId));
    await db
      .update(checkpointLogs)
      .set({ deletedAt: new Date() })
      .where(eq(checkpointLogs.checkpointId, "physics"));
    const scans = await Promise.all(
      Array.from({ length: 4 }, () =>
        checkInAttendee(db, id, { qrCodeId, checkpointId: "physics" }),
      ),
    );
    assert.equal(new Set(scans.map((scan) => scan.log.id)).size, 1);
    assert.equal(scans.filter((scan) => !scan.alreadyCheckedIn).length, 1);
    const [log] = await db
      .select()
      .from(checkpointLogs)
      .where(eq(checkpointLogs.id, scans[0].log.id));
    assert.equal(log.checkerId, user.staff.id);
    assert.equal(log.attendeeId, attendee.id);
    await db
      .update(staffs)
      .set({ permission: [] })
      .where(eq(staffs.userId, id));
    await assert.rejects(
      checkInAttendee(db, id, { qrCodeId, checkpointId: "physics" }),
      isStatus(403),
    );
  });

  it("enforces unique QR codes in the migrated database", async () => {
    const [attendee] = await db
      .select()
      .from(attendees)
      .where(eq(attendees.qrCodeId, qrCodeId));
    await assert.rejects(
      db.insert(attendees).values({ ...attendee, id: crypto.randomUUID() }),
    );
  });
});
