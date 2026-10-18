import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it, mock } from "bun:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { isHttpError } from "@sveltejs/kit";
import { ZodError } from "zod";
import { parse, stringify } from "devalue";
import { transport } from "../src/hooks";
import { getPlatformProxy } from "wrangler";
import { getDb, tables } from "../src/lib/server/db/index";

describe("atomic workshop registration on D1", () => {
  let proxy;
  let directory;
  let db;
  let registerForWorkshop;
  let unregisterFromWorkshop;
  let registerRemotely;
  let unregisterRemotely;
  let getMyWorkshopRegistrations;
  let getWorkshopBySlug;
  let event;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "openhouse-workshops-"));
    const configPath = join(directory, "wrangler.json");
    await writeFile(
      configPath,
      JSON.stringify({
        name: "workshop-test",
        compatibility_date: "2026-10-06",
        d1_databases: [{ binding: "DB", database_name: "workshop-test" }],
      }),
    );
    proxy = await getPlatformProxy({
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
        .filter((statement) => statement.trim())) {
        await proxy.env.DB.prepare(statement).run();
      }
    }
    db = getDb(proxy.env.DB);
    mock.module("$app/env", () => ({
      browser: false,
      building: false,
      dev: true,
      version: "test",
    }));
    mock.module("cloudflare:workers", () => ({ env: { DB: proxy.env.DB } }));
    ({ registerForWorkshop, unregisterFromWorkshop } =
      await import("../src/lib/features/workshops/service.server"));
    // Keep the real schema, ownership lookup, D1 service, and devalue transport.
    // Replace only SvelteKit's command wrapper and request context.
    mock.module("$app/server", () => ({
      command: (schema, handler) => async (input) => {
        const result = await handler(schema.parse(input));
        const encoders = Object.fromEntries(
          Object.entries(transport).map(([key, value]) => [key, value.encode]),
        );
        const decoders = Object.fromEntries(
          Object.entries(transport).map(([key, value]) => [key, value.decode]),
        );
        return parse(stringify(result, encoders), decoders);
      },
      query: (...args) => {
        const handler = args.at(-1);
        return (...input) => {
          const result = handler(...input);
          result.refresh = async () => {};
          return result;
        };
      },
      getRequestEvent: () => event,
    }));
    ({
      registerForWorkshop: registerRemotely,
      unregisterFromWorkshop: unregisterRemotely,
      getMyWorkshopRegistrations,
      getWorkshopBySlug,
    } = await import("../src/lib/features/workshops/workshops.remote"));
  });

  afterAll(async () => {
    await proxy?.dispose();
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  async function attendee() {
    const [user] = await db
      .insert(tables.users)
      .values({
        googleId: crypto.randomUUID(),
        email: "test@example.com",
        name: "Attendee",
        role: "attendee",
      })
      .returning();
    const [profile] = await db
      .insert(tables.attendees)
      .values({
        userId: user.id,
        qrCodeId: crypto.randomUUID(),
        title: "Mx",
        firstname: "Test",
        lastname: "Attendee",
        age: 18,
        residentProvince: "Bangkok",
        type: "student",
      })
      .returning();
    return profile;
  }

  async function workshop(
    capacity = 10,
    intervals = [{ start: 540, end: 600, date: "2030-01-01" }],
  ) {
    const [workshop] = await db
      .insert(tables.workshops)
      .values({
        slug: crypto.randomUUID(),
        title: "Workshop",
        hostDepartment: "physics",
        hostDepartimentAbbr: "PHYS",
        description: "Test workshop",
        capacity,
      })
      .returning();
    const slots = await db
      .insert(tables.workshopTimeSlots)
      .values(
        intervals.map(({ start, end, date }, index) => {
          const day = new Date(`${date}T00:00:00Z`);
          return {
            workshopId: workshop.id,
            roundNumber: index + 1,
            startsAt: new Date(day.getTime() + start * 60_000),
            endsAt: new Date(day.getTime() + end * 60_000),
          };
        }),
      )
      .returning();
    return { ...workshop, slots };
  }

  function book(attendeeId, slug, round = 1, type = "advance") {
    return registerForWorkshop({
      attendeeId,
      workshopSlug: slug,
      workshopRoundNumber: round,
      type,
    });
  }

  function cancel(attendeeId, slug, round = 1) {
    return unregisterFromWorkshop({
      attendeeId,
      workshopSlug: slug,
      workshopRoundNumber: round,
    });
  }

  function requestAs(
    userId,
    origin = "https://openhouse.test",
    now = "2026-10-21T00:00:00.000Z",
  ) {
    const url = new URL("https://openhouse.test/workshops");
    event = {
      locals: { user: userId ? { id: userId } : null },
      url,
      request: new Request(url, { method: "POST", headers: { origin } }),
      cookies: { get: () => now },
    };
  }

  function remoteInput(target) {
    return { workshopSlug: target.slug, workshopRoundNumber: 1 };
  }

  const hasStatus = (status, message) => (cause) =>
    isHttpError(cause, status) &&
    (message === undefined || cause.body.message === message);

  function expectError(result, code) {
    assert.ok(result.isErr());
    assert.equal(result.error, code);
  }

  async function activeRegistrations(slotId) {
    return db
      .select()
      .from(tables.workshopRegistrations)
      .where(
        and(
          eq(tables.workshopRegistrations.workshopTimeSlotId, slotId),
          isNull(tables.workshopRegistrations.deletedAt),
        ),
      );
  }

  it("returns the persisted registration with generated identity and timestamps", async () => {
    const person = await attendee();
    const target = await workshop();
    const result = await book(person.id, target.slug, 1, "walk-in");
    assert.ok(result.isOk());
    assert.equal(result.value.attendeeId, person.id);
    assert.equal(result.value.workshopTimeSlotId, target.slots[0].id);
    assert.equal(result.value.type, "walk-in");
    assert.ok(result.value.id);
    assert.ok(result.value.createdAt instanceof Date);
    assert.ok(result.value.updatedAt instanceof Date);
    assert.equal(result.value.deletedAt, null);
    assert.deepEqual(await activeRegistrations(target.slots[0].id), [
      result.value,
    ]);
  });

  it("gets one workshop by slug", async () => {
    const selected = await workshop();
    await workshop();

    const result = await getWorkshopBySlug(selected.slug);
    assert.ok(result.isOk());
    assert.equal(result.value.slug, selected.slug);
  });

  it("keeps the last seat exclusive under simultaneous advance and walk-in requests", async () => {
    const target = await workshop(1);
    const people = await Promise.all(
      Array.from({ length: 8 }, () => attendee()),
    );
    const results = await Promise.all(
      people.map((person, index) =>
        book(person.id, target.slug, 1, index % 2 ? "advance" : "walk-in"),
      ),
    );
    assert.equal(results.filter((result) => result.isOk()).length, 1);
    for (const result of results.filter((result) => result.isErr())) {
      expectError(result, "WORKSHOP_FULL");
    }
    assert.equal((await activeRegistrations(target.slots[0].id)).length, 1);
  });

  it("rejects simultaneous duplicate registrations and another round of the same workshop", async () => {
    const person = await attendee();
    const target = await workshop(10, [
      { start: 540, end: 600, date: "2030-01-01" },
      { start: 660, end: 720, date: "2030-01-01" },
    ]);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => book(person.id, target.slug)),
    );
    assert.equal(results.filter((result) => result.isOk()).length, 1);
    for (const result of results.filter((result) => result.isErr())) {
      expectError(result, "ALREADY_REGISTERED_FOR_WORKSHOP");
    }
    expectError(
      await book(person.id, target.slug, 2),
      "ALREADY_REGISTERED_FOR_WORKSHOP",
    );
    assert.equal((await activeRegistrations(target.slots[0].id)).length, 1);
    assert.equal((await activeRegistrations(target.slots[1].id)).length, 0);
  });

  it("prevents simultaneous overlapping bookings across different workshops", async () => {
    const person = await attendee();
    const first = await workshop();
    const second = await workshop(10, [
      { start: 570, end: 630, date: "2030-01-01" },
    ]);
    const results = await Promise.all([
      book(person.id, first.slug),
      book(person.id, second.slug),
    ]);
    assert.equal(results.filter((result) => result.isOk()).length, 1);
    expectError(
      results.find((result) => result.isErr()),
      "WORKSHOP_TIME_CONFLICT",
    );
  });

  it("rejects equal, enclosing, enclosed, and partially overlapping intervals", async () => {
    const person = await attendee();
    const existing = await workshop();
    assert.ok((await book(person.id, existing.slug)).isOk());
    for (const [start, end] of [
      [540, 600],
      [510, 630],
      [550, 590],
      [510, 570],
      [570, 630],
    ]) {
      const target = await workshop(10, [{ start, end, date: "2030-01-01" }]);
      expectError(await book(person.id, target.slug), "WORKSHOP_TIME_CONFLICT");
    }
  });

  it("allows back-to-back workshops and the same clock times on another day", async () => {
    const person = await attendee();
    const existing = await workshop();
    assert.ok((await book(person.id, existing.slug)).isOk());
    for (const interval of [
      { start: 480, end: 540, date: "2030-01-01" },
      { start: 600, end: 660, date: "2030-01-01" },
      { start: 540, end: 600, date: "2030-01-02" },
    ]) {
      const target = await workshop(10, [interval]);
      assert.ok((await book(person.id, target.slug, 1, "walk-in")).isOk());
    }
  });

  it("rejects an overlap across midnight even when the slot dates differ", async () => {
    const person = await attendee();
    const overnight = await workshop(10, [
      { start: 1410, end: 1470, date: "2030-01-01" },
    ]);
    const nextDay = await workshop(10, [
      { start: 0, end: 60, date: "2030-01-02" },
    ]);
    assert.ok((await book(person.id, overnight.slug)).isOk());
    expectError(await book(person.id, nextDay.slug), "WORKSHOP_TIME_CONFLICT");
  });

  it("counts capacity separately per round", async () => {
    const target = await workshop(1, [
      { start: 540, end: 600, date: "2030-01-01" },
      { start: 660, end: 720, date: "2030-01-01" },
    ]);
    const first = await attendee();
    const second = await attendee();
    assert.ok((await book(first.id, target.slug, 1)).isOk());
    assert.ok((await book(second.id, target.slug, 2)).isOk());
  });

  it("atomically limits attendees to two active advance registrations", async () => {
    const person = await attendee();
    const targets = await Promise.all([
      workshop(10, [{ start: 540, end: 600, date: "2030-01-01" }]),
      workshop(10, [{ start: 660, end: 720, date: "2030-01-01" }]),
      workshop(10, [{ start: 780, end: 840, date: "2030-01-01" }]),
    ]);

    const results = await Promise.all(
      targets.map((target) => book(person.id, target.slug)),
    );
    assert.equal(results.filter((result) => result.isOk()).length, 2);
    expectError(
      results.find((result) => result.isErr()),
      "WORKSHOP_ADVANCE_REGISTRATION_LIMIT_REACHED",
    );
  });

  it("excludes walk-ins and cancelled registrations from the advance limit", async () => {
    const person = await attendee();
    const first = await workshop(10, [
      { start: 540, end: 600, date: "2030-01-01" },
    ]);
    const second = await workshop(10, [
      { start: 660, end: 720, date: "2030-01-01" },
    ]);
    const third = await workshop(10, [
      { start: 780, end: 840, date: "2030-01-01" },
    ]);
    const walkIn = await workshop(10, [
      { start: 900, end: 960, date: "2030-01-01" },
    ]);

    assert.ok((await book(person.id, first.slug)).isOk());
    assert.ok((await book(person.id, second.slug)).isOk());
    assert.ok((await book(person.id, walkIn.slug, 1, "walk-in")).isOk());
    const cancelled = await cancel(person.id, first.slug);
    assert.ok(cancelled.isOk());
    assert.ok((await book(person.id, third.slug)).isOk());
  });

  it("does not book a round with zero capacity", async () => {
    const target = await workshop(0);
    expectError(
      await book((await attendee()).id, target.slug),
      "WORKSHOP_FULL",
    );
  });

  it("ignores cancelled registrations for capacity, duplicates, and overlaps", async () => {
    const person = await attendee();
    const target = await workshop(1);
    const result = await book(person.id, target.slug);
    assert.ok(result.isOk());
    await db
      .update(tables.workshopRegistrations)
      .set({ deletedAt: new Date() })
      .where(eq(tables.workshopRegistrations.id, result.value.id));
    assert.ok((await book(person.id, target.slug)).isOk());
  });

  it("soft-deletes only the selected attendee registration and allows rebooking", async () => {
    const first = await attendee();
    const second = await attendee();
    const target = await workshop();
    const firstBooking = await book(first.id, target.slug);
    const secondBooking = await book(second.id, target.slug);
    assert.ok(firstBooking.isOk());
    assert.ok(secondBooking.isOk());

    const result = await cancel(first.id, target.slug);
    assert.ok(result.isOk());
    assert.equal(result.value.id, firstBooking.value.id);
    assert.ok(result.value.deletedAt instanceof Date);
    assert.deepEqual(await activeRegistrations(target.slots[0].id), [
      secondBooking.value,
    ]);
    assert.ok((await book(first.id, target.slug)).isOk());
  });

  it("returns Err when no matching active registration can be cancelled", async () => {
    const person = await attendee();
    const target = await workshop();
    expectError(
      await cancel(person.id, target.slug),
      "WORKSHOP_REGISTRATION_NOT_FOUND",
    );
    assert.ok((await book(person.id, target.slug)).isOk());
    assert.ok((await cancel(person.id, target.slug)).isOk());
    expectError(
      await cancel(person.id, target.slug),
      "WORKSHOP_REGISTRATION_NOT_FOUND",
    );
    expectError(
      await cancel(person.id, target.slug, 99),
      "WORKSHOP_REGISTRATION_NOT_FOUND",
    );
  });

  it("rejects missing or disabled workshops and rounds", async () => {
    const person = await attendee();
    const target = await workshop();
    expectError(
      await book(person.id, "missing"),
      "WORKSHOP_TIME_SLOT_NOT_FOUND",
    );
    expectError(
      await book(person.id, target.slug, 99),
      "WORKSHOP_TIME_SLOT_NOT_FOUND",
    );
    await db
      .update(tables.workshopTimeSlots)
      .set({ deletedAt: new Date() })
      .where(eq(tables.workshopTimeSlots.id, target.slots[0].id));
    expectError(
      await book(person.id, target.slug),
      "WORKSHOP_TIME_SLOT_NOT_FOUND",
    );
    const disabled = await workshop();
    await db
      .update(tables.workshops)
      .set({ deletedAt: new Date() })
      .where(eq(tables.workshops.id, disabled.id));
    expectError(
      await book(person.id, disabled.slug),
      "WORKSHOP_TIME_SLOT_NOT_FOUND",
    );
  });

  it("rejects missing or disabled attendees and disabled accounts", async () => {
    const target = await workshop();
    expectError(await book("missing", target.slug), "ATTENDEE_NOT_FOUND");
    const disabledAttendee = await attendee();
    await db
      .update(tables.attendees)
      .set({ deletedAt: new Date() })
      .where(eq(tables.attendees.id, disabledAttendee.id));
    expectError(
      await book(disabledAttendee.id, target.slug),
      "ATTENDEE_NOT_FOUND",
    );
    const disabledUser = await attendee();
    await db
      .update(tables.users)
      .set({ deletedAt: new Date() })
      .where(eq(tables.users.id, disabledUser.userId));
    expectError(await book(disabledUser.id, target.slug), "ATTENDEE_NOT_FOUND");
    assert.equal((await activeRegistrations(target.slots[0].id)).length, 0);
  });

  it("returns database failures as Err without persisting a registration", async () => {
    const person = await attendee();
    const target = await workshop();
    await proxy.env.DB.prepare(
      `CREATE TRIGGER test_registration_failure BEFORE INSERT ON workshop_registrations
       BEGIN SELECT RAISE(ABORT, 'test database failure'); END`,
    ).run();
    try {
      expectError(
        await book(person.id, target.slug),
        "REGISTER_FOR_WORKSHOP_FAILED",
      );
      requestAs(person.userId);
      expectError(
        await registerRemotely(remoteInput(target)),
        "REGISTER_FOR_WORKSHOP_FAILED",
      );
      assert.equal((await activeRegistrations(target.slots[0].id)).length, 0);
    } finally {
      await proxy.env.DB.prepare(
        "DROP TRIGGER test_registration_failure",
      ).run();
    }
  });

  it("the remote command books advance registration for the signed-in user's attendee profile", async () => {
    const otherPerson = await attendee();
    const person = await attendee();
    const target = await workshop();
    requestAs(person.userId);

    const result = await registerRemotely(remoteInput(target));
    assert.ok(result.isOk());
    const registration = result.value;
    assert.ok(registration.createdAt instanceof Date);
    assert.equal(registration.attendeeId, person.id);
    assert.notEqual(registration.attendeeId, otherPerson.id);
    assert.notEqual(registration.attendeeId, person.userId);
    assert.equal(registration.workshopTimeSlotId, target.slots[0].id);
    assert.equal(registration.type, "advance");
    assert.deepEqual(await activeRegistrations(target.slots[0].id), [
      registration,
    ]);
  });

  it("returns only the signed-in attendee's active workshop registrations", async () => {
    const person = await attendee();
    const otherPerson = await attendee();
    const first = await workshop();
    const second = await workshop();
    assert.ok((await book(person.id, first.slug)).isOk());
    assert.ok((await book(otherPerson.id, second.slug)).isOk());
    requestAs(person.userId);

    const result = await getMyWorkshopRegistrations();
    assert.ok(result.isOk());
    assert.equal(result.value.length, 1);
    assert.equal(result.value[0].workshopSlug, first.slug);
    assert.equal(result.value[0].workshopRoundNumber, 1);
  });

  it("the remote command rejects caller-supplied identity or registration type and invalid rounds", async () => {
    const person = await attendee();
    const target = await workshop();
    requestAs(person.userId);
    for (const extra of [
      { attendeeId: "someone-else" },
      { type: "walk-in" },
      { workshopSlug: "" },
      { workshopRoundNumber: 0 },
      { workshopRoundNumber: 1.5 },
      { workshopRoundNumber: "1" },
    ]) {
      await assert.rejects(
        registerRemotely({ ...remoteInput(target), ...extra }),
        (cause) => cause instanceof ZodError,
      );
    }
    assert.equal((await activeRegistrations(target.slots[0].id)).length, 0);
  });

  it("the remote command requires sign-in and a same-origin request", async () => {
    const target = await workshop();
    requestAs(null);
    await assert.rejects(registerRemotely(remoteInput(target)), hasStatus(401));
    requestAs((await attendee()).userId, "https://another-site.test");
    await assert.rejects(registerRemotely(remoteInput(target)), hasStatus(403));
    assert.equal((await activeRegistrations(target.slots[0].id)).length, 0);
  });

  it("the remote command enforces the workshop registration window", async () => {
    const person = await attendee();
    const target = await workshop();

    requestAs(
      person.userId,
      "https://openhouse.test",
      "2026-10-20T10:59:59.999Z",
    );
    expectError(
      await registerRemotely(remoteInput(target)),
      "WORKSHOP_REGISTRATION_NOT_OPEN",
    );

    requestAs(
      person.userId,
      "https://openhouse.test",
      "2026-10-31T17:00:00.000Z",
    );
    expectError(
      await registerRemotely(remoteInput(target)),
      "WORKSHOP_REGISTRATION_CLOSED",
    );
    assert.equal((await activeRegistrations(target.slots[0].id)).length, 0);
  });

  it("rejects advance registration once the workshop round starts", async () => {
    const person = await attendee();
    const target = await workshop(10, [
      { start: 0, end: 60, date: "2026-10-21" },
    ]);
    requestAs(person.userId);

    expectError(
      await registerRemotely(remoteInput(target)),
      "WORKSHOP_ALREADY_STARTED",
    );
    assert.equal((await activeRegistrations(target.slots[0].id)).length, 0);
  });

  it("the remote command unregisters the signed-in attendee until the deadline", async () => {
    const owner = await attendee();
    const otherPerson = await attendee();
    const target = await workshop();
    const ownerBooking = await book(owner.id, target.slug);
    const otherBooking = await book(otherPerson.id, target.slug);
    assert.ok(ownerBooking.isOk());
    assert.ok(otherBooking.isOk());
    requestAs(
      owner.userId,
      "https://openhouse.test",
      "2026-10-31T16:59:59.999Z",
    );

    const result = await unregisterRemotely(remoteInput(target));
    assert.ok(result.isOk());
    assert.equal(result.value.id, ownerBooking.value.id);
    assert.deepEqual(await activeRegistrations(target.slots[0].id), [
      otherBooking.value,
    ]);
  });

  it("the remote command rejects unregistration at the closing boundary", async () => {
    const person = await attendee();
    const target = await workshop();
    const booking = await book(person.id, target.slug);
    assert.ok(booking.isOk());
    requestAs(
      person.userId,
      "https://openhouse.test",
      "2026-10-31T17:00:00.000Z",
    );

    expectError(
      await unregisterRemotely(remoteInput(target)),
      "WORKSHOP_REGISTRATION_CLOSED",
    );
    assert.deepEqual(await activeRegistrations(target.slots[0].id), [
      booking.value,
    ]);
  });

  it("the unregistration command validates ownership, origin, and input", async () => {
    const owner = await attendee();
    const target = await workshop();
    assert.ok((await book(owner.id, target.slug)).isOk());

    requestAs(null);
    await assert.rejects(
      unregisterRemotely(remoteInput(target)),
      hasStatus(401),
    );
    requestAs(owner.userId, "https://another-site.test");
    await assert.rejects(
      unregisterRemotely(remoteInput(target)),
      hasStatus(403),
    );
    requestAs(owner.userId);
    await assert.rejects(
      unregisterRemotely({ ...remoteInput(target), attendeeId: "other" }),
      (cause) => cause instanceof ZodError,
    );
    assert.equal((await activeRegistrations(target.slots[0].id)).length, 1);
  });

  it("the remote command returns Err for missing and disabled attendee profiles", async () => {
    const target = await workshop();
    requestAs(crypto.randomUUID());
    expectError(
      await registerRemotely(remoteInput(target)),
      "ATTENDEE_NOT_FOUND",
    );
    const person = await attendee();
    await db
      .update(tables.attendees)
      .set({ deletedAt: new Date() })
      .where(eq(tables.attendees.id, person.id));
    requestAs(person.userId);
    expectError(
      await registerRemotely(remoteInput(target)),
      "ATTENDEE_NOT_FOUND",
    );
    assert.equal((await activeRegistrations(target.slots[0].id)).length, 0);
  });

  it("the remote command returns Err for duplicate and overlapping registrations", async () => {
    const person = await attendee();
    const target = await workshop();
    requestAs(person.userId);
    await registerRemotely(remoteInput(target));
    expectError(
      await registerRemotely(remoteInput(target)),
      "ALREADY_REGISTERED_FOR_WORKSHOP",
    );
    const overlapping = await workshop();
    expectError(
      await registerRemotely(remoteInput(overlapping)),
      "WORKSHOP_TIME_CONFLICT",
    );
  });

  it("the remote command returns Err for full rounds and missing slots", async () => {
    const person = await attendee();
    requestAs(person.userId);
    const full = await workshop(0);
    expectError(await registerRemotely(remoteInput(full)), "WORKSHOP_FULL");
    expectError(
      await registerRemotely({ ...remoteInput(full), workshopRoundNumber: 99 }),
      "WORKSHOP_TIME_SLOT_NOT_FOUND",
    );
  });
});
