import assert from "node:assert/strict";
import { beforeEach, it, mock } from "bun:test";
import { isHttpError } from "@sveltejs/kit";
import { err, ok } from "neverthrow";

let user;
const getAttendeeProfile = mock();
const createAttendeeProfile = mock();
const generateQrCode = mock();
const command = mock((_schema, handler) => handler);

mock.module("$app/server", () => ({
  command,
  query: (...args) => args.at(-1),
  getRequestEvent: () => ({ locals: { user } }),
}));
mock.module("nanoid", () => ({ customAlphabet: () => generateQrCode }));
mock.module("../src/lib/features/attendees/service.server", () => ({
  getAttendeeProfile,
  createAttendeeProfile,
}));

const { selfRegisterAttendee } =
  await import("../src/lib/features/attendees/attendees.remote");
const input = {
  title: "Mx",
  firstname: "Test",
  lastname: "Attendee",
  age: 18,
  residentProvince: "Bangkok",
  type: "student",
};

beforeEach(() => {
  user = { id: "signed-in-user" };
  getAttendeeProfile.mockReset();
  createAttendeeProfile.mockReset();
  generateQrCode.mockReset();
  generateQrCode.mockReturnValue("ABCDE");
});

it("registers through a command, retries occupied QR codes, and returns the created profile", async () => {
  assert.equal(command.mock.results[0].value, selfRegisterAttendee);
  generateQrCode.mockReturnValueOnce("TAKEN").mockReturnValueOnce("ABCDE");
  getAttendeeProfile
    .mockResolvedValueOnce(ok({ qrCodeId: "TAKEN" }))
    .mockResolvedValueOnce(ok(undefined));
  const profile = {
    ...input,
    id: "attendee-profile",
    userId: user.id,
    qrCodeId: "ABCDE",
  };
  createAttendeeProfile.mockResolvedValue(ok(profile));

  assert.equal(await selfRegisterAttendee(input), profile);
  assert.deepEqual(
    getAttendeeProfile.mock.calls.map(([query]) => query),
    [{ qrCodeId: "TAKEN" }, { qrCodeId: "ABCDE" }],
  );
  assert.deepEqual(createAttendeeProfile.mock.calls, [
    [{ ...input, userId: user.id, qrCodeId: "ABCDE" }],
  ]);
});

it("stops on a lookup error without attempting an insert", async () => {
  getAttendeeProfile.mockResolvedValue(
    err(err("FETCH_ATTENDEE_PROFILE_FAILED")),
  );

  await assert.rejects(selfRegisterAttendee(input), (cause) =>
    isHttpError(cause, 500),
  );
  assert.equal(getAttendeeProfile.mock.calls.length, 1);
  assert.equal(createAttendeeProfile.mock.calls.length, 0);
});

it("reports an insert error without retrying the write", async () => {
  getAttendeeProfile.mockResolvedValue(ok(undefined));
  createAttendeeProfile.mockResolvedValue(
    err(err("CREATE_ATTENDEE_PROFILE_FAILED")),
  );

  await assert.rejects(selfRegisterAttendee(input), (cause) =>
    isHttpError(cause, 500),
  );
  assert.equal(createAttendeeProfile.mock.calls.length, 1);
});

it("requires a signed-in user before accessing profiles", async () => {
  user = null;

  await assert.rejects(selfRegisterAttendee(input), (cause) =>
    isHttpError(cause, 401),
  );
  assert.equal(getAttendeeProfile.mock.calls.length, 0);
  assert.equal(createAttendeeProfile.mock.calls.length, 0);
});
