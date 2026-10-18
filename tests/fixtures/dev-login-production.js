import assert from "node:assert/strict";
import { mock } from "bun:test";
import { isHttpError } from "@sveltejs/kit";

// Model the production build-time flag, with no session or database available.
// A development command must reject before reaching either boundary.
const unexpectedAccess = mock(() => {
  throw new Error("Production dev-login guard was bypassed");
});
mock.module("$app/env", () => ({ dev: false }));
mock.module("$app/server", () => ({
  command: (_schema, handler) => handler,
  getRequestEvent: unexpectedAccess,
}));
mock.module("cloudflare:workers", () => ({ env: {} }));
mock.module("../../src/lib/features/auth/auth.remote", () => ({
  getSession: unexpectedAccess,
}));
mock.module("../../src/lib/features/auth/config.server", () => ({
  getAuthDb: unexpectedAccess,
  getSessionSettings: unexpectedAccess,
}));
const { createDevSession } =
  await import("../../src/lib/features/auth/dev.remote");

for (const profile of ["attendee", "newcomer", "staff"]) {
  await assert.rejects(createDevSession({ profile }), (cause) =>
    isHttpError(cause, 404),
  );
}
assert.equal(unexpectedAccess.mock.calls.length, 0);
