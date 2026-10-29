import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseQrCode } from "../src/lib/qr-code";

describe("parseQrCode", () => {
  it("accepts a real code and upper-cases a typed one", () => {
    assert.deepEqual(parseQrCode("AC7#@"), { kind: "valid", code: "AC7#@" });
    assert.deepEqual(parseQrCode("  ac7#@ "), { kind: "valid", code: "AC7#@" });
  });

  it("rejects wrong lengths and look-alike characters", () => {
    for (const input of ["", "AC7#", "AC7#@2", "AB7#@", "AC0#@", "AC1#@"]) {
      assert.deepEqual(parseQrCode(input), { kind: "invalid" }, input);
    }
  });

  it("passes other input through as typed only when allowed (development)", () => {
    assert.deepEqual(parseQrCode("dev-attendee-qr", { allowAny: true }), {
      kind: "valid",
      code: "dev-attendee-qr",
    });
    assert.deepEqual(parseQrCode("   ", { allowAny: true }), {
      kind: "invalid",
    });
  });
});
