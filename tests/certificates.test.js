import { inflateRawSync, deflateRawSync } from "node:zlib";
import { describe, it, expect, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { exportJWK, generateKeyPair, SignJWT, CompactSign } from "jose";
import {
  normalizationRules,
  normalizationReady,
  normalizeCertificateText,
} from "../src/lib/features/certificates/normalization";
import {
  CERTIFICATE_EVENT,
  reviewName,
  registrationCertificateName,
  sameName,
} from "../src/lib/features/certificates/shared";
import {
  currentIssuance,
  issueStatements,
  replacementStatements,
  claimLease,
  completeLease,
  snapshotName,
} from "../src/lib/features/certificates/repository.server";
import {
  certificateConfig,
  publicKeys,
} from "../src/lib/features/certificates/config.server";
import {
  signCertificate,
  verifyCertificateToken,
  verificationUrl,
} from "../src/lib/features/certificates/token.server";
import { verifyRecognizedCertificate } from "../src/lib/features/certificates/verification.server";
import {
  certificateQr,
  certificateHtml,
  escapeHtml,
} from "../src/lib/features/certificates/renderer.server";
const raw = {
  title: "mr",
  customTitle: "",
  firstName: "สมชาย",
  lastName: "ใจดี",
  school: "โรงเรียนเตรียมอุดมศึกษา",
};
const name = reviewName(raw);
const open = [];
afterEach(() => {
  for (const db of open.splice(0)) db.close();
});
function memory() {
  const sqlite = new Database(":memory:");
  open.push(sqlite);
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const migration of readdirSync("drizzle").sort())
    sqlite.exec(readFileSync(`drizzle/${migration}/migration.sql`, "utf8"));
  sqlite.exec(`INSERT INTO users(id,google_id,email,name,role) VALUES ('u','g','a@example.test','Name','attendee'),('admin','admin','admin@example.test','Admin','staff');
    INSERT INTO attendees(id,user_id,qrCodeId,title,firstname,lastname,age,resident_province,type) VALUES ('a','u','CODE1','mr','First','Last',18,'Bangkok','student');
    INSERT INTO checkpoints(id,type) VALUES('entry','entry');`);
  const db = {
    prepare(sql) {
      return {
        bind(...params) {
          return statement(sql, params);
        },
        ...statement(sql, []),
      };
    },
    async batch(statements) {
      return sqlite.transaction(() => statements.map((s) => s.runSync()))();
    },
    withSession() {
      return db;
    },
  };
  function statement(sql, params) {
    return {
      async first() {
        return sqlite.query(sql).get(...params) ?? null;
      },
      async all() {
        return { results: sqlite.query(sql).all(...params) };
      },
      runSync() {
        const result = sqlite.query(sql).run(...params);
        return { meta: { changes: result.changes } };
      },
      async run() {
        return this.runSync();
      },
    };
  }
  const eligible = () =>
    sqlite.exec(
      `INSERT INTO checkpoint_logs(id,attendee_id,checkpoint_id) VALUES('entry-log','a','entry');INSERT INTO survey_responses(id,attendee_id,answer) VALUES('survey','a','{}');`,
    );
  return { sqlite, db, eligible };
}
const candidate = (overrides = {}) => ({
  id: crypto.randomUUID(),
  certificateId: crypto.randomUUID(),
  name,
  event: JSON.stringify(CERTIFICATE_EVENT),
  token: crypto.randomUUID(),
  template: "openhouse-2027-v1",
  now: 1000,
  ...overrides,
});
async function keys() {
  const pair = await generateKeyPair("ES256", { extractable: true });
  const pub = { ...(await exportJWK(pair.publicKey)), kid: "prod-test" };
  const priv = { ...(await exportJWK(pair.privateKey)), kid: pub.kid };
  return {
    pair,
    pub,
    env: {
      CERTIFICATE_PUBLIC_KEYS: JSON.stringify([pub]),
      CERTIFICATE_PRIVATE_JWK: JSON.stringify(priv),
    },
  };
}
describe("supplied Thai corrections", () => {
  it("keeps all 15 literal patterns and order, globally and with Unicode", () => {
    const patterns = [
      "ํ[าๅ]",
      "เเ",
      "([เ-ไ])[^฀-ฮ]+",
      "([ะ-ำๅ])[ัำ-ฺ๊-ํ็-้]+",
      "(ำ)[ั-ฺ็-ํ]+",
      "([าิ-ืํ])[ะ-ฺๅ็ํ]+",
      "([ุ-ฺ])[ะ-ฺๅ็ํ]+",
      "(็)[ะ-ฺๅ็ํ]+",
      "([่-๋])[ัำ-ฺ็-ํ]+",
      "(่)[่-]+",
      "(้)[่-]+",
      "(๊)[่-]+",
      "(๋)[่-]+",
      "(์)[่-]+",
      "([^฀-ฮ])์+",
    ];
    expect(normalizationReady).toBe(true);
    expect(
      normalizationRules.map(([r]) =>
        r.source.replace(/\\u([0-9a-f]{4})/gi, (_, hex) =>
          String.fromCharCode(parseInt(hex, 16)),
        ),
      ),
    ).toEqual(patterns);
    expect(normalizationRules.map(([r]) => r.flags)).toEqual(
      Array(15).fill("gu"),
    );
  });
  const examples = [
    ["ํา ํๅ", "ำ ำ"],
    ["เเเเ", "แแ"],
    ["เABCก", "เก"],
    ["ะั", "ะ"],
    ["ำ่", "ำ"],
    ["าิ", "า"],
    ["ุะ", "ุ"],
    ["็ะ", "็"],
    ["่ั", "่"],
    ["่้", "่"],
    ["้๊", "้"],
    ["๊๋", "๊"],
    ["๋์", "๋"],
    ["์่", "์"],
    ["A์", "A"],
  ];
  examples.forEach(([input, output], index) =>
    it(`rule ${index + 1} has the supplied behavior`, () => {
      expect(input.replace(...normalizationRules[index])).toBe(output);
    }),
  );
  it("preserves supplied destructive behavior and order with field boundaries", () => {
    expect(normalizeCertificateText("  เเABCก  ")).toBe("แก");
    const result = reviewName({
      ...raw,
      firstName: "เ",
      lastName: "ABC",
      school: " เเABCก ",
    });
    expect(result.firstName).toBe("เ");
    expect(result.lastName).toBe("ABC");
    expect(result.school).toBe("แก");
    expect(raw.firstName).toBe("สมชาย");
  });
  it("normalizes NFC and trims independently, including custom titles and school", () => {
    expect(normalizeCertificateText("  José  ")).toBe("José");
    expect(
      reviewName({
        ...raw,
        title: "other",
        customTitle: " ดร. ",
        firstName: " José ",
        school: " Test School ",
      }).displayName,
    ).toBe("ดร. José ใจดี");
    expect(
      reviewName({
        ...raw,
        title: "other",
        customTitle: " ดร. ",
        school: " Test School ",
      }).school,
    ).toBe("Test School");
  });
  it("maps stored codes and display labels and does not print internal codes", () => {
    for (const title of ["mr", "นาย"])
      expect(
        registrationCertificateName({
          title,
          prefixOther: null,
          firstname: "A",
          lastname: "B",
          school: null,
        }).title,
      ).toBe("mr");
    expect(reviewName(raw).title).toBe("นาย");
    expect(
      registrationCertificateName({
        title: "Dr.",
        prefixOther: "Dr.",
        firstname: "A",
        lastname: "B",
        school: "School",
      }).customTitle,
    ).toBe("Dr.");
    expect(sameName(name, { ...name, school: "Different School" })).toBe(false);
  });
  it("rejects empty fields, controls and unknown titles", () => {
    for (const bad of [
      { firstName: " " },
      {
        lastName: `A
B`,
      },
      { customTitle: " ", title: "other" },
      { title: "unknown" },
      { school: "A‎B" },
    ])
      expect(() => reviewName({ ...raw, ...bad })).toThrow();
  });
});
describe("permanent entitlement and immutable issuances", () => {
  it("requires all eligibility conditions inside the issuing database operation", async () => {
    const { db, sqlite } = memory();
    await db.batch(issueStatements(db, "u", CERTIFICATE_EVENT.id, candidate()));
    expect(sqlite.query("SELECT count(*) n FROM certificates").get()).toEqual({
      n: 0,
    });
    sqlite.exec(
      `INSERT INTO checkpoint_logs(id,attendee_id,checkpoint_id) VALUES('l','a','entry')`,
    );
    await db.batch(issueStatements(db, "u", CERTIFICATE_EVENT.id, candidate()));
    expect(await currentIssuance(db, "u", CERTIFICATE_EVENT.id)).toBeNull();
    sqlite.exec(
      `INSERT INTO survey_responses(id,attendee_id,answer) VALUES('s','a','{}');UPDATE attendees SET deleted_at=1`,
    );
    await db.batch(issueStatements(db, "u", CERTIFICATE_EVENT.id, candidate()));
    expect(await currentIssuance(db, "u", CERTIFICATE_EVENT.id)).toBeNull();
    sqlite.exec("UPDATE attendees SET deleted_at=NULL");
    const issued = candidate();
    await db.batch(issueStatements(db, "u", CERTIFICATE_EVENT.id, issued));
    expect(
      snapshotName(await currentIssuance(db, "u", CERTIFICATE_EVENT.id)),
    ).toEqual(name);
    expect(await currentIssuance(db, "other", CERTIFICATE_EVENT.id)).toBeNull();
  });
  it("returns the committed winner under concurrent confirmations and preserves snapshots", async () => {
    const { db, sqlite, eligible } = memory();
    eligible();
    const winner = candidate();
    await db.batch(issueStatements(db, "u", CERTIFICATE_EVENT.id, winner));
    await Promise.all(
      Array.from({ length: 8 }, () =>
        db.batch(issueStatements(db, "u", CERTIFICATE_EVENT.id, candidate())),
      ),
    );
    expect((await currentIssuance(db, "u", CERTIFICATE_EVENT.id))?.id).toBe(
      winner.id,
    );
    expect(
      sqlite.query("SELECT count(*) n FROM certificate_issuances").get(),
    ).toEqual({ n: 1 });
    expect(() =>
      sqlite.exec("UPDATE certificate_issuances SET school='Changed'"),
    ).toThrow();
    expect(() => sqlite.exec("DELETE FROM certificates")).toThrow();
    expect(() => sqlite.exec("DELETE FROM certificate_issuances")).toThrow();
    sqlite.exec(
      "UPDATE checkpoint_logs SET deleted_at=2;UPDATE survey_responses SET deleted_at=2",
    );
    expect(
      (await currentIssuance(db, "u", CERTIFICATE_EVENT.id))?.revoked_at,
    ).toBeNull();
  });
  it("rolls back the entitlement when an issuance insert fails", async () => {
    const { db, sqlite, eligible } = memory();
    eligible();
    const bad = candidate({ token: null });
    await expect(
      db.batch(issueStatements(db, "u", CERTIFICATE_EVENT.id, bad)),
    ).rejects.toThrow();
    expect(sqlite.query("SELECT count(*) n FROM certificates").get()).toEqual({
      n: 0,
    });
  });
  it("prevents self-service reissue after revocation and replaces once with audit", async () => {
    const { db, sqlite, eligible } = memory();
    eligible();
    const original = candidate();
    await db.batch(issueStatements(db, "u", CERTIFICATE_EVENT.id, original));
    sqlite.exec(
      `UPDATE certificate_issuances SET revoked_at=1001,revoked_by='admin',revocation_reason='Correction'`,
    );
    await db.batch(issueStatements(db, "u", CERTIFICATE_EVENT.id, candidate()));
    expect((await currentIssuance(db, "u", CERTIFICATE_EVENT.id))?.id).toBe(
      original.id,
    );
    const old = await currentIssuance(db, "u", CERTIFICATE_EVENT.id);
    const next = candidate({
      certificateId: old.certificate_id,
      name: { ...name, school: "New School" },
      now: 1002,
    });
    await db.batch(
      replacementStatements(db, old, "admin", "School correction", next),
    );
    await db.batch(
      replacementStatements(
        db,
        old,
        "admin",
        "Concurrent replacement",
        candidate({ certificateId: old.certificate_id }),
      ),
    );
    expect((await currentIssuance(db, "u", CERTIFICATE_EVENT.id))?.id).toBe(
      next.id,
    );
    expect(
      sqlite.query("SELECT count(*) n FROM certificate_issuances").get(),
    ).toEqual({ n: 2 });
    expect(
      sqlite
        .query(
          "SELECT created_by,reason,supersedes_id FROM certificate_issuances WHERE id=?",
        )
        .get(next.id),
    ).toEqual({
      created_by: "admin",
      reason: "School correction",
      supersedes_id: old.id,
    });
    expect(sqlite.query("PRAGMA foreign_key_check").all()).toEqual([]);
  });
  it("enforces lease ownership, expiry and revocation during rendering", async () => {
    const { db, sqlite, eligible } = memory();
    eligible();
    const issued = candidate();
    await db.batch(issueStatements(db, "u", CERTIFICATE_EVENT.id, issued));
    expect(await claimLease(db, issued.id, "first", 2000)).not.toBeNull();
    expect(await claimLease(db, issued.id, "second", 2089)).toBeNull();
    expect(
      await completeLease(db, issued.id, "wrong", "bad.pdf", 2001),
    ).toBeNull();
    expect(await claimLease(db, issued.id, "second", 2090)).not.toBeNull();
    expect(
      await completeLease(db, issued.id, "first", "stale.pdf", 2091),
    ).toBeNull();
    sqlite.exec(
      `UPDATE certificate_issuances SET revoked_at=2091,revoked_by='admin',revocation_reason='Revoke during render'`,
    );
    expect(
      await completeLease(db, issued.id, "second", "revoked.pdf", 2092),
    ).toBeNull();
    expect(await claimLease(db, issued.id, "third", 2300)).toBeNull();
  });
});
describe("signature, recognition and printed QR", () => {
  it("round-trips title, exact name, school, schedule, award date without PII or expiry", async () => {
    const { env } = await keys();
    const id = crypto.randomUUID();
    const token = await signCertificate(env, {
      id,
      certificateId: crypto.randomUUID(),
      name,
      now: Math.floor(Date.now() / 1000),
    });
    const claims = await verifyCertificateToken(env, token);
    expect(claims.name).toEqual(name);
    expect(claims.event).toEqual(CERTIFICATE_EVENT);
    expect(claims.event.awardDate).toBe("2026-11-01");
    const payload = JSON.parse(
      inflateRawSync(Buffer.from(token.split(".")[1], "base64url")).toString(),
    );
    expect(payload.exp).toBeUndefined();
    expect(payload.email).toBeUndefined();
    expect(payload.userId).toBeUndefined();
    expect(
      certificateQr(verificationUrl(env, token)).moduleMm,
    ).toBeGreaterThanOrEqual(0.3);
    const [, body, signature] = token.split(".");
    await expect(
      verifyCertificateToken(
        env,
        `${Buffer.from('{"alg":"none"}').toString("base64url")}.${body}.${signature}`,
      ),
    ).rejects.toThrow();
    await expect(
      verifyCertificateToken(env, "A".repeat(4097)),
    ).rejects.toThrow();
    await expect(
      verifyCertificateToken(
        { ...env, CERTIFICATE_PUBLIC_KEYS: JSON.stringify([]) },
        token,
      ),
    ).rejects.toThrow();
  });
  it("compresses before signing, preserves legacy JWT verification and rejects invalid/bloated payloads", async () => {
    const { env, pair } = await keys();
    const token = await signCertificate(env, {
      id: crypto.randomUUID(),
      certificateId: crypto.randomUUID(),
      name,
      now: Math.floor(Date.now() / 1000),
    });
    const payload = JSON.parse(
      inflateRawSync(Buffer.from(token.split(".")[1], "base64url")).toString(),
    );
    const legacy = await new SignJWT(payload)
      .setProtectedHeader({ alg: "ES256", kid: "prod-test", typ: "cert+jwt" })
      .sign(pair.privateKey);
    expect(await verifyCertificateToken(env, legacy)).toEqual(
      await verifyCertificateToken(env, token),
    );
    expect(token.length).toBeLessThan(legacy.length * 0.85);
    expect(certificateQr(verificationUrl(env, token)).modules).toBeLessThan(
      certificateQr(verificationUrl(env, legacy)).modules,
    );
    for (const bytes of [
      new TextEncoder().encode("not deflate"),
      deflateRawSync("x".repeat(20000)),
    ]) {
      const invalid = await new CompactSign(bytes)
        .setProtectedHeader({
          alg: "ES256",
          kid: "prod-test",
          typ: "cert+deflate",
        })
        .sign(pair.privateKey);
      await expect(verifyCertificateToken(env, invalid)).rejects.toThrow();
    }
    const parts = token.split(".");
    parts[1] = (parts[1][0] === "A" ? "B" : "A") + parts[1].slice(1);
    await expect(
      verifyCertificateToken(env, parts.join(".")),
    ).rejects.toThrow();
  });
  it("rejects wrong type, algorithm, issuer, audience, version and key URLs", async () => {
    const { env, pair } = await keys();
    const valid = {
      ver: 1,
      n: [name.title, name.firstName, name.lastName, name.school],
      e: Object.values(CERTIFICATE_EVENT),
      jti: crypto.randomUUID(),
      iss: "https://verify.vidyachula.org",
      aud: "sci-cert",
      iat: Math.floor(Date.now() / 1000),
    };
    for (const change of [
      { ver: 2 },
      { iss: "https://bad.invalid" },
      { aud: "bad" },
      { extra: "unexpected" },
    ]) {
      const token = await new SignJWT({ ...valid, ...change })
        .setProtectedHeader({ alg: "ES256", kid: "prod-test", typ: "cert+jwt" })
        .sign(pair.privateKey);
      await expect(verifyCertificateToken(env, token)).rejects.toThrow();
    }
    for (const header of [
      { typ: "JWT" },
      { jku: "https://bad.invalid/jwks.json" },
    ]) {
      const token = await new SignJWT(valid)
        .setProtectedHeader({
          alg: "ES256",
          kid: "prod-test",
          typ: "cert+jwt",
          ...header,
        })
        .sign(pair.privateKey);
      await expect(verifyCertificateToken(env, token)).rejects.toThrow();
    }
  });
  it("checks recognized exact stored tokens, explicit revocation, replacement and unavailable storage", async () => {
    const { env } = await keys();
    const { db, sqlite, eligible } = memory();
    eligible();
    env.DB = db;
    const issued = candidate({ now: Math.floor(Date.now() / 1000) });
    issued.token = await signCertificate(env, {
      ...issued,
      event: CERTIFICATE_EVENT,
    });
    expect((await verifyRecognizedCertificate(env, issued.token)).status).toBe(
      "invalid",
    );
    await db.batch(issueStatements(db, "u", CERTIFICATE_EVENT.id, issued));
    expect((await verifyRecognizedCertificate(env, issued.token)).status).toBe(
      "valid",
    );
    const alternate = await signCertificate(env, {
      ...issued,
      event: CERTIFICATE_EVENT,
      now: issued.now + 1,
    });
    expect((await verifyRecognizedCertificate(env, alternate)).status).toBe(
      "invalid",
    );
    const old = await currentIssuance(db, "u", CERTIFICATE_EVENT.id);
    const next = candidate({
      certificateId: old.certificate_id,
      now: issued.now,
    });
    next.token = await signCertificate(env, {
      ...next,
      event: CERTIFICATE_EVENT,
    });
    await db.batch(
      replacementStatements(db, old, "admin", "Correct name", next),
    );
    expect((await verifyRecognizedCertificate(env, issued.token)).status).toBe(
      "revoked",
    );
    expect((await verifyRecognizedCertificate(env, next.token)).status).toBe(
      "valid",
    );
    sqlite.close();
    open.splice(open.indexOf(sqlite), 1);
    expect((await verifyRecognizedCertificate(env, next.token)).status).toBe(
      "unavailable",
    );
  });
  it("retains historical keys, supports disabling them, and separates preview namespaces", async () => {
    const { env, pub } = await keys();
    const token = await signCertificate(env, {
      ...candidate(),
      event: CERTIFICATE_EVENT,
      now: Math.floor(Date.now() / 1000),
    });
    const disabled = {
      ...env,
      CERTIFICATE_PUBLIC_KEYS: JSON.stringify([{ ...pub, disabled: true }]),
    };
    expect(publicKeys(disabled)).toEqual([]);
    await expect(verifyCertificateToken(disabled, token)).rejects.toThrow();
    expect(() =>
      certificateConfig({
        ...env,
        CERTIFICATE_EVENT_ORIGIN: "https://preview.example.test",
      }),
    ).toThrow();
    expect(() =>
      certificateConfig({
        ...env,
        CERTIFICATE_EVENT_ORIGIN: "https://preview.example.test",
        CERTIFICATE_ISSUER: "https://verify-preview.example.test",
      }),
    ).toThrow();
  });
  it("rejects excessive QR density and escapes user markup", () => {
    expect(() =>
      certificateQr("https://verify.vidyachula.org/c/" + "a".repeat(1800)),
    ).toThrow();
    expect(escapeHtml('<img src="bad">&')).toBe(
      "&lt;img src=&quot;bad&quot;&gt;&amp;",
    );
  });
});
