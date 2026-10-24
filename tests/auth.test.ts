import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isHttpError, type Cookies } from "@sveltejs/kit";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { eq } from "drizzle-orm";
import { getPlatformProxy } from "wrangler";
import { getDb, type Db } from "../src/lib/server/db/index";
import { users, attendees, staffs } from "../src/lib/server/db/tables";
import {
  getSessionSettings,
  type SessionSettings,
} from "../src/lib/features/auth/config.server";
import {
  verifyGoogleIdToken,
  type GoogleIdentity,
} from "../src/lib/features/auth/google.server";
import {
  findOrCreateGoogleUser,
  findSessionUser,
} from "../src/lib/features/auth/service.server";
import { ensureDevFixture } from "../src/lib/features/auth/dev-fixtures.server";
import {
  requireSameOrigin,
  requireStaff,
  requireUser,
} from "../src/lib/features/auth/guards.server";
import { devSessionInput } from "../src/lib/features/auth/schemas";
import {
  beginLoginChallenge,
  challengeCookieName,
  clearLoginChallenge,
  clearSessionCookie,
  issueSessionToken,
  readLoginChallenge,
  sessionCookieName,
  setSessionCookie,
  verifySessionToken,
} from "../src/lib/features/auth/session.server";

class MemoryCookies implements Cookies {
  values = new Map<string, string>();
  writes: Array<{
    name: string;
    value: string;
    options: NonNullable<Parameters<Cookies["set"]>[2]>;
  }> = [];
  get(name: string) {
    return this.values.get(name);
  }
  getAll() {
    return [...this.values].map(([name, value]) => ({ name, value }));
  }
  set(
    name: string,
    value: string,
    options: Parameters<Cookies["set"]>[2] = {},
  ) {
    this.values.set(name, value);
    this.writes.push({ name, value, options });
  }
  delete(name: string, options: Parameters<Cookies["delete"]>[1]) {
    this.set(name, "", { ...options, maxAge: 0 });
    this.values.delete(name);
  }
  serialize(name: string, value: string) {
    return `${name}=${value}`;
  }
  parse(): never {
    throw new Error("Set-Cookie parsing is not used by this test double");
  }
}

const settings: SessionSettings = {
  key: crypto.getRandomValues(new Uint8Array(32)),
  development: false,
};
const isStatus = (status: number) => (cause: unknown) =>
  isHttpError(cause, status);

it("requires a matching Origin for auth commands, including during development", () => {
  const url = new URL("http://localhost:5173/");
  requireSameOrigin({
    url,
    request: new Request(url, { headers: { origin: url.origin } }),
  });
  for (const headers of [
    new Headers(),
    new Headers({ origin: "https://attacker.invalid" }),
  ]) {
    assert.throws(
      () => requireSameOrigin({ url, request: new Request(url, { headers }) }),
      isStatus(403),
    );
  }
});

describe("session tokens and cookies", () => {
  it("expires exactly 24 hours after issue and rejects tampering", async () => {
    const now = new Date("2027-10-16T00:00:00Z");
    const issued = await issueSessionToken("user-1", settings, now);
    assert.equal(issued.expiresAt, "2027-10-17T00:00:00.000Z");
    assert.equal(
      (await verifySessionToken(issued.token, settings, now))?.userId,
      "user-1",
    );
    assert.ok(
      await verifySessionToken(
        issued.token,
        settings,
        new Date("2027-10-16T23:59:59Z"),
      ),
    );
    assert.equal(
      await verifySessionToken(
        issued.token,
        settings,
        new Date(issued.expiresAt),
      ),
      null,
    );
    const parts = issued.token.split(".");
    parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
    assert.equal(
      await verifySessionToken(parts.join("."), settings, now),
      null,
    );
  });

  it("rejects wrong keys, cross-environment sessions, and excessive lifetimes", async () => {
    const devSettings = { ...settings, development: true };
    const issued = await issueSessionToken("dev-user-staff", devSettings);
    assert.equal(await verifySessionToken(issued.token, settings), null);
    assert.equal(
      await verifySessionToken(issued.token, {
        ...devSettings,
        key: crypto.getRandomValues(new Uint8Array(32)),
      }),
      null,
    );
    const longToken = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("openhouse")
      .setAudience("openhouse:session:production")
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime("2d")
      .sign(settings.key);
    assert.equal(await verifySessionToken(longToken, settings), null);
  });

  it("sets a host-only HttpOnly production cookie and clears it on logout", async () => {
    const cookies = new MemoryCookies();
    await setSessionCookie(cookies, "user-1", settings);
    const write = cookies.writes[0];
    assert.equal(write.name, "__Host-session");
    assert.equal(write.options.httpOnly, true);
    assert.equal(write.options.secure, true);
    assert.equal(write.options.sameSite, "lax");
    assert.equal(write.options.path, "/");
    assert.equal(write.options.maxAge, 86400);
    assert.equal(write.options.domain, undefined);
    clearSessionCookie(cookies, false);
    assert.equal(cookies.get(sessionCookieName(false)), undefined);
    assert.equal(cookies.writes.at(-1)?.options.maxAge, 0);
  });

  it("uses a separate local cookie and rejects missing or malformed signing secrets", async () => {
    const cookies = new MemoryCookies();
    await setSessionCookie(cookies, "dev-user-attendee", {
      ...settings,
      development: true,
    });
    assert.equal(cookies.writes[0].name, "vidyachula-session-dev");
    assert.equal(cookies.writes[0].options.secure, false);
    assert.throws(() => getSessionSettings(undefined, true), isStatus(503));
    assert.throws(
      () => getSessionSettings({ AUTH_JWT_SECRET: "weak" }, false),
      isStatus(503),
    );
    assert.equal(
      getSessionSettings({ AUTH_JWT_SECRET: "ab".repeat(32) }, true).key.length,
      32,
    );
  });

  it("binds Google login to an expiring signed challenge, distinct from session JWTs", async () => {
    const cookies = new MemoryCookies();
    assert.equal(await readLoginChallenge(cookies, settings), null);
    const nonce = await beginLoginChallenge(cookies, settings);
    assert.equal(await readLoginChallenge(cookies, settings), nonce);
    const challenge = cookies.get(challengeCookieName(false))!;
    assert.equal(await verifySessionToken(challenge, settings), null);
    assert.equal(
      await readLoginChallenge(
        cookies,
        settings,
        new Date(Date.now() + 301000),
      ),
      null,
    );
    clearLoginChallenge(cookies, false);
    assert.equal(await readLoginChallenge(cookies, settings), null);
    const session = await issueSessionToken("user-1", settings);
    cookies.values.set(challengeCookieName(false), session.token);
    assert.equal(await readLoginChallenge(cookies, settings), null);
  });
});

describe("Google verification", () => {
  let privateKey: CryptoKey;
  let keys: ReturnType<typeof createLocalJWKSet>;
  before(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    keys = createLocalJWKSet({
      keys: [{ ...(await exportJWK(pair.publicKey)), kid: "test" }],
    });
  });

  async function token(overrides: Record<string, unknown> = {}) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
      sub: "google-user-1",
      email: "user@example.com",
      email_verified: true,
      name: "Example User",
      nonce: "login-nonce",
      iss: "https://accounts.google.com",
      aud: "client-id",
      iat: now,
      exp: now + 3600,
      ...overrides,
    })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .sign(privateKey);
  }

  it("accepts verified claims and both documented Google issuers", async () => {
    for (const iss of ["accounts.google.com", "https://accounts.google.com"]) {
      const identity = await verifyGoogleIdToken(
        await token({ iss }),
        "client-id",
        "login-nonce",
        keys,
      );
      assert.equal(identity.sub, "google-user-1");
    }
  });

  it("rejects invalid issuer, audience, expiry, nonce, authorized party, and unverified email", async () => {
    for (const overrides of [
      { iss: "https://attacker.invalid" },
      { aud: "another-client" },
      { exp: Math.floor(Date.now() / 1000) - 1 },
      { exp: undefined },
      { nonce: "another-browser" },
      { nonce: undefined },
      { email_verified: false },
      { azp: "another-client" },
    ]) {
      await assert.rejects(
        verifyGoogleIdToken(
          await token(overrides),
          "client-id",
          "login-nonce",
          keys,
        ),
        isStatus(401),
      );
    }
  });

  it("rejects forged signatures and reports key-service failures separately", async () => {
    const parts = (await token()).split(".");
    parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
    await assert.rejects(
      verifyGoogleIdToken(parts.join("."), "client-id", "login-nonce", keys),
      isStatus(401),
    );
    await assert.rejects(
      verifyGoogleIdToken(
        await token(),
        "client-id",
        "login-nonce",
        async () => {
          throw new TypeError("Network unavailable");
        },
      ),
      isStatus(503),
    );
  });
});

describe("D1 identity and development fixtures", () => {
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
  let directory: string;
  let db: Db;
  before(async () => {
    directory = await mkdtemp(join(tmpdir(), "openhouse-auth-test-"));
    const configPath = join(directory, "wrangler.json");
    await writeFile(
      configPath,
      JSON.stringify({
        name: "openhouse-auth-test",
        compatibility_date: "2027-10-06",
        d1_databases: [{ binding: "DB", database_name: "auth-test" }],
      }),
    );
    proxy = await getPlatformProxy<{ DB: D1Database }>({
      configPath,
      persist: false,
      remoteBindings: false,
      envFiles: [],
    });
    for (const migration of (await readdir("drizzle")).sort()) {
      const migrationPath = join("drizzle", migration, "migration.sql");
      // Drizzle can leave empty local directories after regenerating migrations.
      if (!existsSync(migrationPath)) continue;
      const sql = await readFile(migrationPath, "utf8");
      for (const statement of sql
        .split("--> statement-breakpoint")
        .filter((s) => s.trim())) {
        await proxy.env.DB.prepare(statement).run();
      }
    }
    db = getDb(proxy.env.DB);
  });
  after(async () => {
    await proxy?.dispose();
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  const identity: GoogleIdentity = {
    sub: "google-real-user",
    email: "same@example.com",
    email_verified: true,
    name: "Original",
    nonce: "verified",
  };

  it("creates one attendee for concurrent logins and preserves staff roles", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () => findOrCreateGoogleUser(db, identity)),
    );
    assert.equal(new Set(results.map((user) => user.id)).size, 1);
    const user = results[0];
    assert.equal(user.role, "attendee");
    await db.update(users).set({ role: "staff" }).where(eq(users.id, user.id));
    const next = await findOrCreateGoogleUser(db, {
      ...identity,
      name: "Updated",
    });
    assert.equal(next.role, "staff");
    assert.equal(next.name, "Updated");
    const separate = await findOrCreateGoogleUser(db, {
      ...identity,
      sub: "another-google-user",
    });
    assert.notEqual(separate.id, user.id);
  });

  it("does not authenticate or resurrect disabled users", async () => {
    const user = await findOrCreateGoogleUser(db, {
      ...identity,
      sub: "disabled-google-user",
    });
    await db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, user.id));
    assert.equal(await findSessionUser(db, user.id), null);
    await assert.rejects(
      findOrCreateGoogleUser(db, { ...identity, sub: "disabled-google-user" }),
      isStatus(403),
    );
  });

  it("creates repeatable local profiles and exercises real sessions and role checks", async () => {
    for (const profile of ["attendee", "staff"] as const) {
      const first = await ensureDevFixture(db, profile, true);
      const second = await ensureDevFixture(db, profile, true);
      assert.equal(first.id, second.id);
      const local = { ...settings, development: true };
      const issued = await issueSessionToken(first.id, local);
      const claims = await verifySessionToken(issued.token, local);
      assert.ok(claims);
      const user = await findSessionUser(db, claims.userId);
      assert.equal(requireUser(user).role, profile);
      if (profile === "staff") assert.equal(requireStaff(user).id, first.id);
      else assert.throws(() => requireStaff(user), isStatus(403));
    }
    assert.equal((await db.select().from(attendees)).length, 1);
    assert.equal((await db.select().from(staffs)).length, 1);
    assert.throws(() => requireUser(null), isStatus(401));
    assert.equal(
      devSessionInput.safeParse({ profile: "staff", role: "admin" }).success,
      false,
    );
    assert.equal(
      devSessionInput.safeParse({ profile: "admin" }).success,
      false,
    );
  });

  it("rejects development fixture creation in production", async () => {
    for (const profile of ["attendee", "newcomer", "staff"] as const) {
      await assert.rejects(ensureDevFixture(db, profile, false), isStatus(404));
    }
  });

  it("creates independent unregistered attendee accounts for repeated development registrations", async () => {
    const first = await ensureDevFixture(db, "newcomer", true);
    const second = await ensureDevFixture(db, "newcomer", true);
    assert.notEqual(first.id, second.id);
    assert.notEqual(first.email, second.email);
    for (const user of [first, second]) {
      assert.equal(user.role, "attendee");
      assert.equal(user.attendee, null);
      assert.equal(user.staff, null);
    }
    await db.insert(attendees).values({
      id: "first-dev-registration",
      userId: first.id,
      qrCodeId: "DEV01",
      title: "mr",
      firstname: "First",
      lastname: "Test",
      age: 18,
      residentProvince: "Bangkok",
      type: "parent",
    });
    assert.deepEqual((await findSessionUser(db, first.id))?.attendee, {
      id: "first-dev-registration",
      qrCodeId: "DEV01",
    });
    assert.equal((await findSessionUser(db, second.id))?.attendee, null);
    const third = await ensureDevFixture(db, "newcomer", true);
    assert.ok(![first.id, second.id].includes(third.id));
    assert.equal(third.attendee, null);
  });

  it("restores the saved attendee identity when the same Google user signs in again", async () => {
    const googleIdentity = { ...identity, sub: "returning-google-attendee" };
    const first = await findOrCreateGoogleUser(db, googleIdentity);
    assert.equal(first.role, "attendee");
    assert.equal(first.attendee, null);
    await db.insert(attendees).values({
      id: "returning-profile",
      userId: first.id,
      qrCodeId: "RTURN",
      title: "mr",
      firstname: "Returning",
      lastname: "Attendee",
      age: 18,
      residentProvince: "Bangkok",
      type: "parent",
    });
    const returning = await findOrCreateGoogleUser(db, googleIdentity);
    assert.equal(returning.id, first.id);
    assert.equal(returning.role, "attendee");
    assert.deepEqual(returning.attendee, {
      id: "returning-profile",
      qrCodeId: "RTURN",
    });
    const issued = await issueSessionToken(returning.id, settings);
    const claims = await verifySessionToken(issued.token, settings);
    assert.ok(claims);
    assert.deepEqual(
      (await findSessionUser(db, claims.userId))?.attendee,
      returning.attendee,
    );
  });
});
