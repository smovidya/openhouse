import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { it } from "bun:test";

it("rejects every development login profile in production before reading or changing session data", () => {
  // Keep build-time environment mocks separate from the development/client tests.
  const result = spawnSync(
    process.execPath,
    [
      "run",
      fileURLToPath(
        new URL("./fixtures/dev-login-production.js", import.meta.url),
      ),
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});
