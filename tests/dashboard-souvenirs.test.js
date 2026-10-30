import { Database } from "bun:sqlite";
import { expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { getSouvenirStats } from "../src/lib/features/dashboard/souvenirs.server";

it("counts tier boundaries, actual attendance, unique redemptions and unmapped rewards", async () => {
  const sqlite = new Database(":memory:");
  try {
    sqlite.exec(`
      CREATE TABLE attendees (id TEXT, deleted_at INTEGER);
      CREATE TABLE checkpoints (id TEXT, name TEXT, type TEXT, department TEXT, deleted_at INTEGER);
      CREATE TABLE checkpoint_logs (id TEXT, attendee_id TEXT, checkpoint_id TEXT, deleted_at INTEGER);
      CREATE TABLE reward_redemptions (id TEXT, attendee_id TEXT, checkpoint_id TEXT, deleted_at INTEGER);
      INSERT INTO attendees VALUES ('basic',NULL),('six',NULL),('twelve',NULL),('seventeen',NULL),('missing',NULL),('deleted',1);
      INSERT INTO checkpoints VALUES ('entry','Entry','entry',NULL,NULL),('tcas','TCAS','tcas',NULL,NULL),('central','Central','central_activity',NULL,NULL),('ws1','Workshop 1','workshop',NULL,NULL),('ws2','Workshop 2','workshop',NULL,NULL),('stage','Stage','stage',NULL,NULL),('removed','Removed','booth',NULL,1),('r0','ระดับพื้นฐาน','reward',NULL,NULL),('r3','หมอนเสืออ้วน','reward',NULL,NULL),('r3b','tier-3','reward',NULL,NULL),('r2','หมวกแก๊ป','reward',NULL,NULL),('unknown','Gift counter','reward',NULL,NULL);
      INSERT INTO reward_redemptions VALUES ('a','six','r3',NULL),('b','six','r3b',NULL),('c','twelve','r3',NULL),('d','seventeen','r2',NULL),('e','deleted','r3',NULL),('f','basic','r3',1),('g','basic','unknown',NULL);
    `);
    for (let i = 1; i <= 17; i++)
      sqlite
        .query("INSERT INTO checkpoints VALUES (?,?,'booth',?,NULL)")
        .run(`b${i}`, `Booth ${i}`, `dept${i}`);
    // Same department in a second checkpoint must not make five booths into six.
    sqlite.exec(
      "INSERT INTO checkpoints VALUES ('duplicate','Repeat','booth','dept1',NULL)",
    );
    const scan = (person, checkpoint, deleted = null) =>
      sqlite
        .query("INSERT INTO checkpoint_logs VALUES (?,?,?,?)")
        .run(crypto.randomUUID(), person, checkpoint, deleted);
    for (const [person, booths, ws] of [
      ["basic", 0, 0],
      ["six", 6, 0],
      ["twelve", 12, 1],
      ["seventeen", 17, 2],
      ["missing", 5, 2],
      ["deleted", 17, 2],
    ]) {
      for (const checkpoint of ["entry", "tcas", "central", "stage"])
        scan(person, checkpoint);
      for (let i = 1; i <= booths; i++) scan(person, `b${i}`);
      for (let i = 1; i <= ws; i++) scan(person, `ws${i}`);
    }
    scan("missing", "duplicate");
    scan("missing", "removed");
    scan("missing", "b6", 1);
    const stats = await getSouvenirStats(drizzle({ client: sqlite }));
    expect(stats.tiers).toEqual([
      { id: "basic", eligible: 5, redeemed: 0 },
      { id: "tier3", eligible: 3, redeemed: 2 },
      { id: "tier2", eligible: 2, redeemed: 1 },
      { id: "tier1", eligible: 1, redeemed: null },
    ]);
    expect(stats.unmappedCheckpoints).toEqual(["Gift counter"]);
    expect(stats.unmappedRedemptions).toBe(1);
    // Every additional condition is required, even with all 17 department scans.
    for (const checkpoint of ["tcas", "central", "ws2", "stage"]) {
      sqlite
        .query(
          "UPDATE checkpoint_logs SET deleted_at=1 WHERE attendee_id='seventeen' AND checkpoint_id=?",
        )
        .run(checkpoint);
      const changed = await getSouvenirStats(drizzle({ client: sqlite }));
      expect(changed.tiers.find((tier) => tier.id === "tier1").eligible).toBe(
        0,
      );
      sqlite
        .query(
          "UPDATE checkpoint_logs SET deleted_at=NULL WHERE attendee_id='seventeen' AND checkpoint_id=?",
        )
        .run(checkpoint);
    }
    // Preregistration alone does not prove entry or workshop attendance.
    sqlite.exec(
      "DELETE FROM checkpoint_logs; DELETE FROM reward_redemptions; DELETE FROM checkpoints",
    );
    const empty = await getSouvenirStats(drizzle({ client: sqlite }));
    expect(
      empty.tiers.every(
        (tier) => tier.eligible === 0 && tier.redeemed === null,
      ),
    ).toBe(true);
  } finally {
    sqlite.close();
  }
});
