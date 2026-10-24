import { Database } from "bun:sqlite";
import { expect, it } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { buildBoothSeedStatements } from "../scripts/seed-booths";

it("preserves legacy journey records and applies constraints without rebuilding their tables", () => {
  const db = new Database(":memory:");
  try {
    db.exec("PRAGMA foreign_keys = ON");
    const migrations = readdirSync("drizzle").sort();
    const journeyMigration = migrations.find((name) =>
      name.endsWith("_event_journey"),
    );
    for (const migration of migrations.filter(
      (name) => name < journeyMigration,
    ))
      db.exec(readFileSync(`drizzle/${migration}/migration.sql`, "utf8"));
    db.exec(`
      INSERT INTO users (id, google_id, email, name, role) VALUES ('u', 'g', 'test@example.com', 'Test', 'attendee');
      INSERT INTO attendees (id, user_id, qrCodeId, title, firstname, lastname, age, resident_province, type)
        VALUES ('a', 'u', 'qr', 'Mx', 'Test', 'Person', 18, 'Bangkok', 'student');
      INSERT INTO checkpoints (id, type) VALUES ('old-workshop', 'workshop'), ('old-reward', 'reward');
      INSERT INTO checkpoint_logs (id, attendee_id, checkpoint_id) VALUES ('log', 'a', 'old-workshop');
      INSERT INTO reward_redemptions (id, attendee_id, checkpoint_id) VALUES ('redemption', 'a', 'old-reward');
    `);
    db.exec(readFileSync(`drizzle/${journeyMigration}/migration.sql`, "utf8"));
    expect(
      db.query("SELECT id, workshop_id FROM checkpoint_logs").all(),
    ).toEqual([{ id: "log", workshop_id: null }]);
    expect(
      db.query("SELECT id, tier, gift_id FROM reward_redemptions").all(),
    ).toEqual([{ id: "redemption", tier: null, gift_id: null }]);
    expect(() =>
      db.exec(
        "INSERT INTO reward_gifts (id, name, tier) VALUES ('bad', 'Bad tier', 4)",
      ),
    ).toThrow();
    expect(() => db.exec("UPDATE reward_redemptions SET tier = 4")).toThrow();
    expect(() =>
      db.exec(
        "INSERT INTO reward_redemptions (id, attendee_id, checkpoint_id) VALUES ('duplicate', 'a', 'old-reward')",
      ),
    ).toThrow();
    for (const statement of buildBoothSeedStatements()) db.exec(statement);
    for (const statement of buildBoothSeedStatements()) db.exec(statement);
    expect(
      db.query("SELECT type FROM checkpoints WHERE id = 'tcas'").get(),
    ).toEqual({ type: "tcas" });
    expect(
      db
        .query(
          "SELECT type, department FROM checkpoints WHERE id = 'central-activity'",
        )
        .get(),
    ).toEqual({ type: "central_activity", department: null });
    expect(
      db
        .query("SELECT count(*) AS n FROM checkpoints WHERE type = 'entry'")
        .get(),
    ).toEqual({ n: 1 });
    expect(db.query("SELECT count(*) AS n FROM checkpoint_logs").get()).toEqual(
      { n: 1 },
    );
    expect(db.query("PRAGMA foreign_key_check").all()).toEqual([]);
  } finally {
    db.close();
  }
});
