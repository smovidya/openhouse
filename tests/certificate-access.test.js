import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { it } from "bun:test";

it("certificate access uses registration and ownership while retaining authentication and administrator guards", () => {
  // Isolate production-environment/module mocks from the other certificate tests.
  const result = spawnSync(
    process.execPath,
    [
      "run",
      fileURLToPath(
        new URL("./fixtures/certificate-access.js", import.meta.url),
      ),
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});
