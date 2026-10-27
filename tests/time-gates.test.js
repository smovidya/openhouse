import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import {
  getTimeGateSnapshot,
  getWorkshopRegistrationGateError,
  getWorkshopUnregistrationGateError,
} from "../src/lib/constants/time";
import {
  clearMockNow,
  getRequestTimeGates,
  MOCK_NOW_COOKIE,
  setMockNow,
} from "../src/lib/features/time/time.server";

class MemoryCookies {
  values = new Map();

  get(name) {
    return this.values.get(name);
  }

  getAll() {
    return [...this.values].map(([name, value]) => ({ name, value }));
  }

  set(name, value) {
    this.values.set(name, value);
  }

  delete(name) {
    this.values.delete(name);
  }

  serialize(name, value) {
    return `${name}=${value}`;
  }

  parse() {
    throw new Error("Set-Cookie parsing is not used by this test double");
  }
}

describe("Bangkok time gates", () => {
  it("keeps sign-in and general registration open regardless of the clock", () => {
    for (const now of [
      "2026-10-01T00:00:00+07:00",
      "2026-10-20T12:00:00+07:00",
      "2026-11-02T00:00:00+07:00",
    ]) {
      const gates = getTimeGateSnapshot(new Date(now));
      assert.equal(gates.flags.signInOpen, true);
      assert.equal(gates.flags.generalRegistrationOpen, true);
      assert.equal("generalRegistrationOpensAt" in gates.schedule, false);
    }
  });

  it("opens workshops at 20 Oct 18:00 and closes at 1 Nov 00:00", () => {
    const before = getTimeGateSnapshot(
      new Date("2026-10-20T17:59:59.999+07:00"),
    );
    const open = getTimeGateSnapshot(new Date("2026-10-20T18:00:00+07:00"));
    const lastMillisecond = getTimeGateSnapshot(
      new Date("2026-10-31T23:59:59.999+07:00"),
    );
    const closed = getTimeGateSnapshot(new Date("2026-11-01T00:00:00+07:00"));
    assert.equal(
      getWorkshopRegistrationGateError(before),
      "WORKSHOP_REGISTRATION_NOT_OPEN",
    );
    assert.equal(getWorkshopRegistrationGateError(open), null);
    assert.equal(lastMillisecond.flags.workshopRegistrationOpen, true);
    assert.equal(
      getWorkshopRegistrationGateError(closed),
      "WORKSHOP_REGISTRATION_CLOSED",
    );
    assert.equal(getWorkshopUnregistrationGateError(lastMillisecond), null);
    assert.equal(
      getWorkshopUnregistrationGateError(closed),
      "WORKSHOP_REGISTRATION_CLOSED",
    );
  });

  it("tracks the event interval with an exclusive end", () => {
    const before = getTimeGateSnapshot(
      new Date("2026-10-31T12:59:59.999+07:00"),
    );
    const started = getTimeGateSnapshot(new Date("2026-10-31T13:00:00+07:00"));
    const ended = getTimeGateSnapshot(new Date("2026-11-01T17:00:00+07:00"));
    assert.equal(before.flags.eventUpcoming, true);
    assert.equal(started.flags.eventInProgress, true);
    assert.equal(ended.flags.eventInProgress, false);
    assert.equal(ended.flags.eventEnded, true);
  });

  it("keeps development clocks isolated per browser and ignores them in production", () => {
    const firstBrowser = new MemoryCookies();
    const secondBrowser = new MemoryCookies();
    const mocked = new Date("2026-10-20T18:00:00+07:00");
    setMockNow(firstBrowser, mocked);

    assert.equal(firstBrowser.get(MOCK_NOW_COOKIE), mocked.toISOString());
    assert.equal(getRequestTimeGates(firstBrowser, true).mocked, true);
    assert.equal(
      getRequestTimeGates(firstBrowser, true).flags.workshopRegistrationOpen,
      true,
    );
    assert.equal(getRequestTimeGates(secondBrowser, true).mocked, false);
    assert.equal(getRequestTimeGates(firstBrowser, false).mocked, false);

    clearMockNow(firstBrowser);
    assert.equal(firstBrowser.get(MOCK_NOW_COOKIE), undefined);
  });
});
