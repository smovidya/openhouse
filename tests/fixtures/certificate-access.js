import assert from "node:assert/strict";
import { expect, mock } from "bun:test";
import { isHttpError } from "@sveltejs/kit";
const origin = "https://scichulaopenhouse.com";
let event;
const state = {
  eligible: true,
  configured: true,
  raw: {
    title: "mr",
    customTitle: "",
    firstName: "Test",
    lastName: "Attendee",
    school: "School",
  },
  issuance: null,
};
const read = mock(async () => state),
  confirm = mock(async () => state),
  prepare = mock(async () => state);
const lookup = mock(async () => null),
  revoke = mock(async () => {}),
  replace = mock(async () => {});
const getPdf = mock(async () => ({
  body: new TextEncoder().encode("%PDF-test"),
}));
const environment = { CERTIFICATE_ASSETS: { get: getPdf } };
const db = {};
const row = {
  id: "issued",
  pdf_key: "certificates/issued.pdf",
  render_state: "ready",
  revoked_at: null,
};
const currentIssuance = mock(async (_db, userId) =>
  userId === "registered-user" ? row : null,
);
mock.module("$app/env", () => ({ dev: false }));
mock.module("$app/server", () => ({
  query: (...args) => args.at(-1),
  command: (...args) => args.at(-1),
  getRequestEvent: () => event,
}));
mock.module("cloudflare:workers", () => ({ env: environment }));
mock.module("../../src/lib/features/certificates/service.server.ts", () => ({
  myCertificate: read,
  confirmCertificate: confirm,
  prepareCertificate: prepare,
  lookupCertificate: lookup,
  revokeCertificate: revoke,
  replaceCertificate: replace,
  database: () => db,
}));
mock.module("../../src/lib/features/certificates/repository.server.ts", () => ({
  currentIssuance,
}));
const remote =
  await import("../../src/lib/features/certificates/certificates.remote.ts");
const { GET: download } =
  await import("../../src/routes/certificate/download/+server.ts");
function reset() {
  event = {
    locals: {
      certificateOperationsAllowed: true,
      user: { id: "registered-user", role: "staff", staff: null },
    },
    url: new URL(origin + "/myid"),
    request: new Request(origin + "/myid", { headers: { origin } }),
  };
  for (const fn of [
    read,
    confirm,
    prepare,
    lookup,
    revoke,
    replace,
    getPdf,
    currentIssuance,
  ])
    fn.mockClear();
}
async function run(name, check) {
  reset();
  try {
    await check();
  } catch (cause) {
    throw new Error(name, { cause });
  }
}

await run(
  "allows registered attendees with a legacy staff role to read, confirm and prepare their own certificate",
  async () => {
    expect(await remote.getMyCertificate()).toEqual(state);
    const input = {
      raw: state.raw,
      reviewed: {
        title: "นาย",
        firstName: "Test",
        lastName: "Attendee",
        displayName: "นาย Test Attendee",
        school: "School",
      },
    };
    await remote.confirmMyCertificateName(input);
    await remote.prepareMyCertificate();
    expect(read).toHaveBeenCalledWith(environment, "registered-user");
    expect(confirm).toHaveBeenCalledWith(environment, "registered-user", input);
    expect(prepare).toHaveBeenCalledWith(environment, "registered-user");
  },
);
await run(
  "still requires authentication, the event host and same-origin mutations",
  async () => {
    event.locals.user = null;
    await assert.rejects(remote.getMyCertificate(), (e) => isHttpError(e, 401));
    event.locals.user = { id: "registered-user", role: "staff", staff: null };
    event.locals.certificateOperationsAllowed = false;
    await assert.rejects(remote.getMyCertificate(), (e) => isHttpError(e, 404));
    event.locals.certificateOperationsAllowed = true;
    event.request = new Request(origin + "/myid", {
      headers: { origin: "https://other.invalid" },
    });
    await assert.rejects(remote.prepareMyCertificate(), (e) =>
      isHttpError(e, 403),
    );
    expect(read).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
  },
);
await run(
  "does not grant certificate administration to a legacy staff role",
  async () => {
    await assert.rejects(remote.adminLookupCertificate("CODE"), (e) =>
      isHttpError(e, 403),
    );
    event.locals.user.staff = { id: "staff", permission: ["activityStaff"] };
    await assert.rejects(remote.adminLookupCertificate("CODE"), (e) =>
      isHttpError(e, 403),
    );
    expect(lookup).not.toHaveBeenCalled();
    event.locals.user.staff.permission = ["admin"];
    await remote.adminLookupCertificate("CODE");
    expect(lookup).toHaveBeenCalledWith(environment, "CODE");
  },
);
await run(
  "allows legacy staff-role attendees to download only their own committed PDF",
  async () => {
    const response = await download(event);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(currentIssuance).toHaveBeenCalledWith(
      db,
      "registered-user",
      "scoh27",
    );
    expect(getPdf).toHaveBeenCalledWith(row.pdf_key);
  },
);
await run(
  "rejects another account's download without reading the PDF",
  async () => {
    event.locals.user = { id: "other-user", role: "staff", staff: null };
    await assert.rejects(download(event), (e) => isHttpError(e, 404));
    expect(getPdf).not.toHaveBeenCalled();
  },
);
await run(
  "rejects anonymous downloads without looking up an issuance",
  async () => {
    event.locals.user = null;
    await assert.rejects(download(event), (e) => isHttpError(e, 401));
    expect(currentIssuance).not.toHaveBeenCalled();
  },
);
