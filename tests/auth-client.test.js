import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "bun:test";

// Mock only the browser/transport boundaries. The real helpers must await both
// the remote command and the layout refresh, including propagation of failures.
const refreshAll = mock(async () => {});
const signInWithGoogle = mock(async () => null);
const createDevSession = mock(async () => null);
const logout = mock(async () => ({ success: true }));
const enrollStaff = mock(async () => null);
const redeemInviteCode = mock(async () => null);
const beginGoogleSignIn = mock(async () => ({
  clientId: "client",
  nonce: "nonce",
}));

mock.module("$app/navigation", () => ({ refreshAll }));
mock.module("../src/lib/features/auth/auth.remote", () => ({
  signInWithGoogle,
  logout,
  beginGoogleSignIn,
}));
mock.module("../src/lib/features/auth/dev.remote", () => ({
  createDevSession,
}));
mock.module("../src/lib/features/staff/staff.remote", () => ({
  enrollStaff,
  redeemInviteCode,
}));

const client = {
  ...(await import("../src/lib/features/auth/auth.client")),
  ...(await import("../src/lib/features/staff/staff.client")),
};

afterEach(() => {
  for (const fn of [
    refreshAll,
    signInWithGoogle,
    createDevSession,
    logout,
    beginGoogleSignIn,
    enrollStaff,
    redeemInviteCode,
  ]) {
    fn.mockReset();
  }
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("auth client session refresh", () => {
  for (const [name, remote, input] of [
    ["signInWithGoogle", signInWithGoogle, { googleIdToken: "credential" }],
    ["createDevSession", createDevSession, { profile: "staff" }],
    ["logout", logout, undefined],
    [
      "enrollStaff",
      enrollStaff,
      {
        name: "Staff",
        phone: "0123456789",
        type: "student",
        code: "invite-code",
      },
    ],
    ["redeemInviteCode", redeemInviteCode, { code: "invite-code" }],
  ]) {
    it(`${name} waits for the command, then refreshes before resolving`, async () => {
      const command = deferred();
      const refresh = deferred();
      remote.mockImplementation(() => command.promise);
      refreshAll.mockImplementation(() => refresh.promise);
      let finished = false;
      const result = { success: true };
      const pending = client[name](input).then((value) => {
        finished = true;
        return value;
      });
      assert.equal(remote.mock.calls.length, 1);
      assert.equal(remote.mock.calls[0][0], input);
      assert.equal(refreshAll.mock.calls.length, 0);
      command.resolve(result);
      await Promise.resolve();
      assert.equal(refreshAll.mock.calls.length, 1);
      assert.equal(finished, false);
      refresh.resolve();
      assert.equal(await pending, result);
    });

    it(`${name} propagates command failures without refreshing`, async () => {
      const failure = new Error("Command failed");
      remote.mockRejectedValue(failure);
      await assert.rejects(client[name](input), (cause) => cause === failure);
      assert.equal(refreshAll.mock.calls.length, 0);
    });
  }

  it("propagates refresh failure without retrying a successful mutation", async () => {
    logout.mockResolvedValue({ success: true });
    const failure = new Error("Refresh failed");
    refreshAll.mockRejectedValue(failure);
    await assert.rejects(client.logout(), (cause) => cause === failure);
    assert.equal(logout.mock.calls.length, 1);
    assert.equal(refreshAll.mock.calls.length, 1);
  });

  it("starts a Google challenge without refreshing the session", async () => {
    const challenge = { clientId: "client", nonce: "nonce" };
    beginGoogleSignIn.mockResolvedValue(challenge);
    assert.equal(await client.beginGoogleSignIn(), challenge);
    assert.equal(refreshAll.mock.calls.length, 0);
  });
});
