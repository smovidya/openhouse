import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import {
  buildCheckpointSeedStatements,
  checkpointCatalog,
} from "../scripts/seed-checkpoints";
import { canScanCheckpoint } from "../src/lib/features/staff/permissions";
import { souvenirTierForCheckpoint } from "../src/lib/features/dashboard/souvenirs";
import { buildBoothSeedStatements } from "../scripts/seed-booths";

function database() {
  const db = new Database(":memory:");
  for (const migration of readdirSync("drizzle").sort()) {
    const path = `drizzle/${migration}/migration.sql`;
    if (existsSync(path)) db.exec(readFileSync(path, "utf8"));
  }
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}
const seed = (db) => {
  for (const statement of buildCheckpointSeedStatements()) db.exec(statement);
};

describe("checkpoint seed", () => {
  it("lets the legacy booth seed reuse event checkpoint IDs, names and history", () => {
    const db = database();
    try {
      seed(db);
      db.exec(`
        INSERT INTO users (id,google_id,email,name,role) VALUES ('u','g','test@example.com','Test','attendee');
        INSERT INTO attendees (id,qrCodeId,user_id,title,firstname,lastname,age,resident_province,type) VALUES ('a','qr','u','Mx','Test','User',18,'Bangkok','student');
        INSERT INTO checkpoint_logs (id,attendee_id,checkpoint_id) VALUES ('log','a','checkpoint-tcas');
      `);
      const before = db.query("SELECT * FROM checkpoints ORDER BY id").all();
      for (let run = 0; run < 2; run++) {
        for (const statement of buildBoothSeedStatements()) db.exec(statement);
        seed(db);
      }
      expect(db.query("SELECT * FROM checkpoints ORDER BY id").all()).toEqual(
        before,
      );
      expect(
        db
          .query("SELECT checkpoint_id FROM checkpoint_logs WHERE id='log'")
          .get(),
      ).toEqual({ checkpoint_id: "checkpoint-tcas" });
      expect(db.query("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("keeps legacy IDs when the booth seed runs first and does not revive deleted checkpoints", () => {
    const db = database();
    try {
      for (const statement of buildBoothSeedStatements()) db.exec(statement);
      db.exec("UPDATE checkpoints SET deleted_at=1 WHERE id='tcas'");
      seed(db);
      for (const statement of buildBoothSeedStatements()) db.exec(statement);
      expect(
        db
          .query("SELECT id,deleted_at FROM checkpoints WHERE type='tcas'")
          .all(),
      ).toEqual([{ id: "tcas", deleted_at: 1 }]);
      expect(
        db
          .query(
            "SELECT id FROM checkpoints WHERE type='booth' AND department='physics'",
          )
          .all(),
      ).toEqual([{ id: "booth-physics" }]);
    } finally {
      db.close();
    }
  });

  it("creates 34 checkpoints linked to the existing permission rules", () => {
    const db = database();
    try {
      seed(db);
      seed(db);
      const checkpoints = db
        .query("SELECT id,name,type,department FROM checkpoints")
        .all();
      expect(checkpoints).toHaveLength(34);
      expect(checkpoints.filter((c) => c.type === "booth")).toHaveLength(17);
      expect(checkpoints.filter((c) => c.type === "workshop")).toHaveLength(9);
      expect(
        checkpoints
          .filter((c) => c.type === "reward")
          .map((c) => souvenirTierForCheckpoint(c.name))
          .sort(),
      ).toEqual(["basic", "tier1", "tier2", "tier3"]);
      for (const checkpoint of checkpoints) {
        const permission =
          checkpoint.type === "booth"
            ? `boothStaff:${checkpoint.department}`
            : checkpoint.type === "tcas"
              ? "boothStaff:tcas"
              : checkpoint.type === "central_activity"
                ? "boothStaff:central-activity"
                : checkpoint.type === "workshop"
                  ? "workshopStaff"
                  : "activityStaff";
        expect(canScanCheckpoint([permission], checkpoint)).toBe(true);
        expect(canScanCheckpoint(["admin"], checkpoint)).toBe(true);
        expect(canScanCheckpoint([], checkpoint)).toBe(false);
        expect(canScanCheckpoint(["boothStaff:all"], checkpoint)).toBe(
          checkpoint.type === "booth",
        );
        expect(canScanCheckpoint(["boothStaff:physics"], checkpoint)).toBe(
          checkpoint.type === "booth" && checkpoint.department === "physics",
        );
      }
      expect(new Set(checkpointCatalog.map((c) => c.id)).size).toBe(34);
    } finally {
      db.close();
    }
  });

  it("preserves existing checkpoint IDs and history, fills missing scope, and leaves deleted checkpoints alone", () => {
    const db = database();
    try {
      db.exec(`
        INSERT INTO checkpoints (id,name,type,department) VALUES ('existing-physics','Physics','booth',NULL),('existing-tcas','Custom TCAS','tcas',NULL),('unrelated','Another activity','stage',NULL);
        INSERT INTO checkpoints (id,name,type,department,deleted_at) VALUES ('deleted-chem','Chem','booth','chemistry',1);
        INSERT INTO users (id,google_id,email,name,role) VALUES ('u','g','test@example.com','Test','attendee');
        INSERT INTO attendees (id,qrCodeId,user_id,title,firstname,lastname,age,resident_province,type) VALUES ('a','qr','u','Mx','Test','User',18,'Bangkok','student');
        INSERT INTO checkpoint_logs (id,attendee_id,checkpoint_id) VALUES ('log','a','existing-physics');
        INSERT INTO reward_redemptions (id,attendee_id,checkpoint_id) VALUES ('redemption','a','existing-tcas');
      `);
      seed(db);
      seed(db);
      expect(
        db.query("SELECT count(*) as count FROM checkpoints").get(),
      ).toEqual({ count: 34 });
      expect(
        db
          .query(
            "SELECT department FROM checkpoints WHERE id='existing-physics'",
          )
          .get(),
      ).toEqual({ department: "physics" });
      expect(
        db
          .query("SELECT checkpoint_id FROM checkpoint_logs WHERE id='log'")
          .get(),
      ).toEqual({ checkpoint_id: "existing-physics" });
      expect(
        db
          .query(
            "SELECT checkpoint_id FROM reward_redemptions WHERE id='redemption'",
          )
          .get(),
      ).toEqual({ checkpoint_id: "existing-tcas" });
      expect(
        db.query("SELECT name FROM checkpoints WHERE id='existing-tcas'").get(),
      ).toEqual({ name: "Custom TCAS" });
      expect(
        db
          .query("SELECT deleted_at FROM checkpoints WHERE id='deleted-chem'")
          .get(),
      ).toEqual({ deleted_at: 1 });
      expect(
        db
          .query(
            "SELECT id FROM checkpoints WHERE id IN ('checkpoint-booth-physics','checkpoint-booth-chemistry','checkpoint-tcas')",
          )
          .all(),
      ).toEqual([]);
      expect(db.query("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
      db.close();
    }
  });
});
