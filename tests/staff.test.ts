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
import {
  createInviteInput,
  enrollStaffInput,
} from "../src/lib/features/staff/schemas";
import {
  createInviteCode,
  disableInviteCode,
  enrollStaff,
  getStaffProfile,
  listBoothDepartments,
  listBoothScopes,
  listInviteCodes,
  redeemInviteCode,
} from "../src/lib/features/staff/service.server";
import {
  checkInAttendee,
  listScannableCheckpoints,
} from "../src/lib/features/checkpoints/service.server";
import { getStaffActions } from "../src/lib/staff";
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
    "boothStaff:tcas",
    "boothStaff:central-activity",
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
  for (const permission of [
    "boothStaff:tcas",
    "boothStaff:central-activity",
  ] as const) {
    assert.equal(hasPermission(["boothStaff:all"], permission), false);
    assert.equal(hasPermission(["activityStaff"], permission), true);
  }
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

it("shows only staff actions allowed by the combined permissions", () => {
  const all = [
    "/staff/booth-check-in",
    "/staff/check-in",
    "/staff/rewards",
    "/staff/workshop-check-in",
  ];
  const cases: Array<[StaffPermission[], string[]]> = [
    [[], []],
    [["boothStaff:physics"], ["/staff/booth-check-in"]],
    [["boothStaff:tcas"], ["/staff/booth-check-in"]],
    [["boothStaff:central-activity"], ["/staff/booth-check-in"]],
    [["boothStaff:all"], ["/staff/booth-check-in"]],
    [["workshopStaff"], ["/staff/workshop-check-in"]],
    [
      ["boothStaff:physics", "workshopStaff"],
      ["/staff/booth-check-in", "/staff/workshop-check-in"],
    ],
    [["activityStaff"], all],
    [["admin"], all],
  ];
  for (const [permissions, expected] of cases) {
    assert.deepEqual(
      getStaffActions(permissions)
        .map((action) => action.href)
        .sort(),
      expected,
    );
  }
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
    const user = requireStaff(
      await enrollStaff(db, id, { ...profile, code: invite.code }),
    );
    return { id, user, invite };
  }

  before(async () => {
    directory = await mkdtemp(join(tmpdir(), "openhouse-staff-test-"));
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
      { id: "tcas", name: "TCAS", type: "tcas" },
      {
        id: "central-activity",
        name: "Central activity",
        type: "central_activity",
      },
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

  it("accepts optional invite inputs but rejects client-controlled access fields", () => {
    for (const code of [undefined, "", "   "]) {
      const parsed = enrollStaffInput.parse({ ...profile, code });
      assert.equal(parsed.code, undefined);
    }
    assert.equal(
      enrollStaffInput.safeParse({ ...profile, code: "short" }).success,
      false,
    );
    for (const extra of [
      { permission: ["admin"] },
      { role: "staff" },
      { userId: adminId },
    ]) {
      assert.equal(
        enrollStaffInput.safeParse({ ...profile, ...extra }).success,
        false,
      );
    }
  });

  it("validates custom codes and keeps blank codes automatic", async () => {
    for (const code of [undefined, "", "   "]) {
      assert.equal(
        createInviteInput.parse({ permission: ["admin"], code }).code,
        undefined,
      );
      const invite = await createInviteCode(db, adminId, ["admin"], code);
      assert.match(invite.code, /^[a-f0-9]{48}$/);
    }
    assert.equal(
      createInviteInput.parse({ permission: ["admin"], code: "  Team-2026  " })
        .code,
      "Team-2026",
    );
    for (const code of ["short", "a".repeat(129)]) {
      assert.equal(
        createInviteInput.safeParse({ permission: ["admin"], code }).success,
        false,
      );
      await assert.rejects(
        createInviteCode(db, adminId, ["admin"], code),
        isStatus(400),
      );
    }
    for (const length of [8, 128]) {
      const code = "a".repeat(length);
      assert.equal(
        (await createInviteCode(db, adminId, ["workshopStaff"], code)).code,
        code,
      );
    }
  });

  it("redeems a trimmed custom code, stores only its hash, and never reuses disabled codes", async () => {
    const code = "TCAS-Team-2026";
    const invite = await createInviteCode(
      db,
      adminId,
      ["boothStaff:tcas"],
      `  ${code}  `,
    );
    assert.equal(invite.code, code);
    const [stored] = await db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.id, invite.id));
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(code),
    );
    assert.equal(stored.codeHash, Buffer.from(digest).toString("hex"));
    assert.equal("code" in stored, false);
    const user = await createUser();
    await assert.rejects(
      enrollStaff(db, user, { ...profile, code: code.toLowerCase() }),
      isStatus(400),
    );
    const enrolled = await enrollStaff(db, user, {
      ...profile,
      code: ` ${code} `,
    });
    assert.deepEqual(enrolled.staff?.permission, ["boothStaff:tcas"]);
    await assert.rejects(
      createInviteCode(db, adminId, ["admin"], code),
      isStatus(409),
    );
    await disableInviteCode(db, adminId, invite.id);
    await assert.rejects(
      createInviteCode(db, adminId, ["admin"], code),
      isStatus(409),
    );
    await assert.rejects(
      enrollStaff(db, await createUser(), { ...profile, code }),
      isStatus(400),
    );
  });

  it("allows only one creation when custom codes collide concurrently", async () => {
    const results = await Promise.allSettled([
      createInviteCode(db, adminId, ["workshopStaff"], "Shared-code-2026"),
      createInviteCode(db, adminId, ["admin"], " Shared-code-2026 "),
    ]);
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(
      rejected?.status === "rejected" && isHttpError(rejected.reason, 409),
    );
  });

  it("offers named department and event booth scopes, plus configured extra departments", async () => {
    await db.insert(checkpoints).values({
      id: "extra-booth",
      type: "booth",
      department: "extra-department",
    });
    try {
      const scopes = await listBoothScopes(db, adminId);
      for (const value of [
        "physics",
        "biology",
        "tcas",
        "central-activity",
        "extra-department",
      ])
        assert.ok(
          scopes.some((scope) => scope.value === `boothStaff:${value}`),
        );
      assert.equal(
        scopes.find((scope) => scope.value === "boothStaff:physics")?.label,
        "บูธ ฟิสิกส์",
      );
      for (const value of [
        "disabled",
        "all",
        "entry",
        "stage",
        "reward",
        "unknown",
      ])
        assert.equal(
          scopes.some((scope) => scope.value === `boothStaff:${value}`),
          false,
        );
      for (const permission of [
        "boothStaff:biology",
        "boothStaff:tcas",
        "boothStaff:central-activity",
        "boothStaff:extra-department",
      ] as const)
        assert.deepEqual(
          (await createInviteCode(db, adminId, [permission])).permission,
          [permission],
        );
      for (const permission of [
        "boothStaff:entry",
        "boothStaff:stage",
        "boothStaff:reward",
        "boothStaff:disabled",
      ] as const)
        await assert.rejects(
          createInviteCode(db, adminId, [permission]),
          isStatus(400),
        );
      await assert.rejects(
        createInviteCode(
          db,
          await createUser(),
          ["boothStaff:tcas"],
          "Custom-code-2026",
        ),
        isStatus(403),
      );
    } finally {
      await db.delete(checkpoints).where(eq(checkpoints.id, "extra-booth"));
    }
  });

  it("saves a pending profile without granting any staff access", async () => {
    const id = await createUser();
    const [attendee] = await db
      .insert(attendees)
      .values({
        userId: id,
        qrCodeId: crypto.randomUUID(),
        title: "Mx",
        firstname: "Existing",
        lastname: "Attendee",
        age: 18,
        residentProvince: "Bangkok",
        type: "student",
      })
      .returning();
    const result = await enrollStaff(db, id, profile);
    assert.equal(result.role, "attendee");
    assert.equal(result.staff, null);
    assert.equal(result.attendee?.id, attendee.id);
    const saved = await getStaffProfile(db, id);
    assert.equal(saved?.name, profile.name);
    assert.deepEqual(saved?.permission, []);
    assert.throws(() => requireStaff(result), isStatus(403));
    await assert.rejects(
      listScannableCheckpoints(db, id, { offset: 0, limit: 50 }),
      isStatus(403),
    );
    await assert.rejects(
      listInviteCodes(db, id, { offset: 0, limit: 50 }),
      isStatus(403),
    );
    await assert.rejects(
      enrollStaff(db, "missing-user", profile),
      isStatus(401),
    );
  });

  it("activates a pending profile with a later invite and stacks later permissions", async () => {
    const id = await createUser();
    await enrollStaff(db, id, profile);
    await assert.rejects(
      redeemInviteCode(db, id, "not-valid-invite"),
      isStatus(400),
    );
    assert.equal((await findSessionUser(db, id))?.staff, null);
    const booth = await createInviteCode(db, adminId, ["boothStaff:physics"]);
    const workshop = await createInviteCode(db, adminId, ["workshopStaff"]);
    const activity = await createInviteCode(db, adminId, ["activityStaff"]);
    const activated = await redeemInviteCode(db, id, booth.code);
    assert.deepEqual(activated.staff.permission, ["boothStaff:physics"]);
    await Promise.all([
      redeemInviteCode(db, id, workshop.code),
      redeemInviteCode(db, id, activity.code),
    ]);
    await redeemInviteCode(db, id, booth.code);
    assert.deepEqual(
      (await getStaffProfile(db, id))?.permission.slice().sort(),
      ["activityStaff", "boothStaff:physics", "workshopStaff"],
    );
    await assert.rejects(
      redeemInviteCode(db, await createUser(), booth.code),
      isStatus(403),
    );
  });

  it("keeps pending signup retries and concurrent activation from losing permissions", async () => {
    const id = await createUser();
    const invite = await createInviteCode(db, adminId, ["boothStaff:physics"]);
    await Promise.all([
      enrollStaff(db, id, profile),
      enrollStaff(db, id, { ...profile, code: invite.code }),
      enrollStaff(db, id, profile),
    ]);
    const result = await enrollStaff(db, id, {
      ...profile,
      name: "Retry must preserve original",
    });
    assert.deepEqual(result.staff?.permission, ["boothStaff:physics"]);
    assert.equal((await getStaffProfile(db, id))?.name, profile.name);
    assert.equal(
      (await db.select().from(staffs).where(eq(staffs.userId, id))).length,
      1,
    );
  });

  it("never revives disabled pending profiles or users through signup without a code", async () => {
    const id = await createUser();
    await enrollStaff(db, id, profile);
    await db
      .update(staffs)
      .set({ deletedAt: new Date() })
      .where(eq(staffs.userId, id));
    await assert.rejects(enrollStaff(db, id, profile), isStatus(403));
    const invite = await createInviteCode(db, adminId, ["workshopStaff"]);
    await assert.rejects(redeemInviteCode(db, id, invite.code), isStatus(403));
    const userId = await createUser();
    await db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, userId));
    await assert.rejects(enrollStaff(db, userId, profile), isStatus(401));
  });

  it("reuses an invite across accounts, preserves attendee records, and exposes safe permissions", async () => {
    const invite = await createInviteCode(db, adminId, ["boothStaff:physics"]);
    const [attendee] = await db
      .select()
      .from(attendees)
      .where(eq(attendees.qrCodeId, qrCodeId));
    for (const id of [attendee.userId, await createUser()]) {
      const user = requireStaff(
        await enrollStaff(db, id, { ...profile, code: invite.code }),
      );
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

  it(
    "enforces the same permission matrix for listing and scanning checkpoints",
    { timeout: 20_000 },
    async () => {
      const cases: Array<[StaffPermission[], string[]]> = [
        [["boothStaff:physics"], ["physics"]],
        [["boothStaff:tcas"], ["tcas"]],
        [["boothStaff:central-activity"], ["central-activity"]],
        [
          ["boothStaff:physics", "boothStaff:tcas"],
          ["physics", "tcas"],
        ],
        [["boothStaff:all"], ["chemistry", "physics"]],
        [["workshopStaff"], ["workshop-1", "workshop-2"]],
        [
          ["activityStaff"],
          [
            "central-activity",
            "chemistry",
            "entry",
            "physics",
            "reward",
            "stage",
            "tcas",
            "workshop-1",
            "workshop-2",
          ],
        ],
        [
          ["admin"],
          [
            "central-activity",
            "chemistry",
            "entry",
            "physics",
            "reward",
            "stage",
            "tcas",
            "workshop-1",
            "workshop-2",
          ],
        ],
      ];
      const all = [
        "central-activity",
        "chemistry",
        "entry",
        "physics",
        "reward",
        "stage",
        "tcas",
        "workshop-1",
        "workshop-2",
      ];
      try {
        await checkInAttendee(db, adminId, { qrCodeId, checkpointId: "entry" });
      } catch (cause) {
        assert.equal(isHttpError(cause, 409), true);
      }
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
          if (!allowed.includes(checkpointId))
            await assert.rejects(
              checkInAttendee(db, id, { qrCodeId, checkpointId }),
              isStatus(403),
            );
          else if (
            ["workshop-1", "workshop-2", "reward"].includes(checkpointId)
          )
            await assert.rejects(
              checkInAttendee(db, id, { qrCodeId, checkpointId }),
              isStatus(400),
            );
          else {
            try {
              await checkInAttendee(db, id, { qrCodeId, checkpointId });
            } catch (cause) {
              assert.equal(isHttpError(cause, 409), true);
            }
          }
        }
        await assert.rejects(
          checkInAttendee(db, id, { qrCodeId, checkpointId: "disabled" }),
          isStatus(404),
        );
      }
    },
  );

  it("makes concurrent repeat scans idempotent and records the trusted checker", async () => {
    const { id, user } = await enroll(["boothStaff:physics"]);
    try {
      await checkInAttendee(db, adminId, { qrCodeId, checkpointId: "entry" });
    } catch (cause) {
      assert.equal(isHttpError(cause, 409), true);
    }
    const [attendee] = await db
      .select()
      .from(attendees)
      .where(eq(attendees.qrCodeId, qrCodeId));
    await db
      .update(checkpointLogs)
      .set({ deletedAt: new Date() })
      .where(eq(checkpointLogs.checkpointId, "physics"));
    const scans = await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        checkInAttendee(db, id, { qrCodeId, checkpointId: "physics" }),
      ),
    );
    const fulfilled = scans.filter(
      (
        scan,
      ): scan is PromiseFulfilledResult<
        Awaited<ReturnType<typeof checkInAttendee>>
      > => scan.status === "fulfilled",
    );
    assert.equal(fulfilled.length, 1);
    assert.equal(scans.filter((scan) => scan.status === "rejected").length, 3);
    assert.ok(
      scans
        .filter(
          (scan): scan is PromiseRejectedResult => scan.status === "rejected",
        )
        .every((scan) => isHttpError(scan.reason, 409)),
    );
    assert.equal(new Set(fulfilled.map((scan) => scan.value.log.id)).size, 1);
    const [log] = await db
      .select()
      .from(checkpointLogs)
      .where(eq(checkpointLogs.id, fulfilled[0].value.log.id));
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
