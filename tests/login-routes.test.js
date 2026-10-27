import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "bun:test";
import { isHttpError, isRedirect } from "@sveltejs/kit";
import { err, ok } from "neverthrow";

const getActiveAttendeeByUserId = mock();
const getAttendeeProfile = mock();
const getWorkshopRegistrationsByAttendeeId = mock();
mock.module("$app/env", () => ({ dev: true }));
mock.module("../src/lib/features/workshops/service.server.ts", () => ({
  getWorkshopRegistrationsByAttendeeId,
}));
mock.module("../src/lib/features/attendees/service.server.ts", () => ({
  getActiveAttendeeByUserId,
  getAttendeeProfile,
  createAttendeeProfile: mock(),
}));
const { GET: login } = await import("../src/routes/login/+server");
const { load: register } = await import("../src/routes/register/+page.server");
const { load: myid } = await import("../src/routes/myid/+page.server");
const request = (user = null) => ({
  locals: { user },
  cookies: { get: () => "2026-10-21T00:00:00.000Z" },
});
const redirectsTo = (location) => (cause) =>
  isRedirect(cause) && cause.status === 303 && cause.location === location;
beforeEach(() => {
  getActiveAttendeeByUserId.mockReset();
  getAttendeeProfile.mockReset();
  getWorkshopRegistrationsByAttendeeId.mockReset();
  getWorkshopRegistrationsByAttendeeId.mockResolvedValue(ok([]));
});

describe("login before registration", () => {
  it("redirects anonymous registration to the main page's sign-in section before reading profiles", async () => {
    await assert.rejects(register(request()), redirectsTo("/#register"));
    assert.equal(getActiveAttendeeByUserId.mock.calls.length, 0);
  });
  it("redirects existing login links to the main page", () => {
    assert.throws(() => login(), redirectsTo("/#register"));
  });
  it("allows registration for a signed-in user without a profile", async () => {
    getActiveAttendeeByUserId.mockResolvedValue(err("ATTENDEE_NOT_FOUND"));
    assert.deepEqual(await register(request({ id: "user" })), {});
    assert.deepEqual(getActiveAttendeeByUserId.mock.calls, [["user"]]);
  });
  it("routes an existing attendee to their QR code", async () => {
    getActiveAttendeeByUserId.mockResolvedValue(ok({ id: "profile" }));
    await assert.rejects(
      register(request({ id: "user" })),
      redirectsTo("/myid"),
    );
  });
  it("does not treat a failed profile lookup as permission to register again", async () => {
    getActiveAttendeeByUserId.mockResolvedValue(
      err("FETCH_ATTENDEE_PROFILE_FAILED"),
    );
    await assert.rejects(register(request({ id: "user" })), (cause) =>
      isHttpError(cause, 503),
    );
  });
});

describe("saved attendee identity", () => {
  it("requires login before reading My ID", async () => {
    await assert.rejects(myid(request()), redirectsTo("/#register"));
    assert.equal(getActiveAttendeeByUserId.mock.calls.length, 0);
    assert.equal(getAttendeeProfile.mock.calls.length, 0);
  });
  it("sends an incomplete attendee to registration", async () => {
    getActiveAttendeeByUserId.mockResolvedValue(err("ATTENDEE_NOT_FOUND"));
    await assert.rejects(
      myid(request({ id: "user" })),
      redirectsTo("/register"),
    );
    assert.equal(getAttendeeProfile.mock.calls.length, 0);
  });
  it("loads the signed-in attendee's saved name and QR code", async () => {
    getActiveAttendeeByUserId.mockResolvedValue(ok({ id: "profile" }));
    getAttendeeProfile.mockResolvedValue(
      ok({
        id: "profile",
        userId: "user",
        firstname: "Saved",
        lastname: "Attendee",
        qrCodeId: "QWERT",
        deletedAt: null,
      }),
    );
    const result = await myid(request({ id: "user" }));
    assert.deepEqual(result.profile, { name: "Saved Attendee", code: "QWERT" });
    assert.deepEqual(result.workshops, []);
    assert.equal(result.advanceCount, 0);
    assert.deepEqual(getActiveAttendeeByUserId.mock.calls, [["user"]]);
    assert.deepEqual(getAttendeeProfile.mock.calls, [[{ id: "profile" }]]);
  });
  it("passes booking types and the current catalog description to My ID", async () => {
    getActiveAttendeeByUserId.mockResolvedValue(ok({ id: "profile" }));
    getAttendeeProfile.mockResolvedValue(
      ok({
        userId: "user",
        firstname: "Test",
        lastname: "Attendee",
        qrCodeId: "QWERT",
      }),
    );
    getWorkshopRegistrationsByAttendeeId.mockResolvedValue(
      ok(
        ["advance", "walk-in"].map((type, index) => ({
          id: `booking-${index}`,
          workshopSlug: "biochem-dna",
          workshopTitle: "Papaya POK POK",
          type,
          startsAt: new Date("2026-10-31T15:30:00+07:00"),
          endsAt: new Date("2026-10-31T16:30:00+07:00"),
        })),
      ),
    );
    const result = await myid(request({ id: "user" }));
    assert.deepEqual(
      result.workshops.map((workshop) => workshop.type),
      ["advance", "walk-in"],
    );
    assert.equal(result.advanceCount, 1);
    assert.ok(result.workshops[0].description.includes("มะละกอ"));
  });
  it("reports database failure instead of redirecting into a registration loop", async () => {
    getActiveAttendeeByUserId.mockResolvedValue(
      err("FETCH_ATTENDEE_PROFILE_FAILED"),
    );
    await assert.rejects(myid(request({ id: "user" })), (cause) =>
      isHttpError(cause, 503),
    );
  });
  it("does not expose missing, deleted, or another user's profile", async () => {
    getActiveAttendeeByUserId.mockResolvedValue(ok({ id: "profile" }));
    for (const profile of [
      undefined,
      { userId: "other" },
      { userId: "user", deletedAt: new Date() },
    ]) {
      getAttendeeProfile.mockResolvedValue(ok(profile));
      await assert.rejects(myid(request({ id: "user" })), (cause) =>
        isHttpError(cause, 503),
      );
    }
    getAttendeeProfile.mockResolvedValue(err("FETCH_ATTENDEE_PROFILE_FAILED"));
    await assert.rejects(myid(request({ id: "user" })), (cause) =>
      isHttpError(cause, 503),
    );
  });
});
