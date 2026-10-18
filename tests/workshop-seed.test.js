import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { buildWorkshopSeedStatements } from "../scripts/seed-workshops";

describe("workshop catalog seed", () => {
  it("loads the catalog and updates it without replacing referenced rows", () => {
    const db = new Database(":memory:");
    try {
      for (const migration of readdirSync("drizzle").sort()) {
        if (!existsSync(`drizzle/${migration}/migration.sql`)) continue;
        db.exec(readFileSync(`drizzle/${migration}/migration.sql`, "utf8"));
      }
      for (const statement of buildWorkshopSeedStatements()) db.exec(statement);
      expect(db.query("SELECT count(*) AS count FROM workshops").get()).toEqual(
        { count: 9 },
      );
      expect(
        db.query("SELECT count(*) AS count FROM workshop_time_slots").get(),
      ).toEqual({ count: 40 });
      expect(
        db.query("SELECT capacity FROM workshops WHERE slug = 'geo-map'").get(),
      ).toEqual({ capacity: 20 });
      expect(
        db
          .query("SELECT capacity FROM workshops WHERE slug = 'biochem-dna'")
          .get(),
      ).toEqual({ capacity: 15 });

      // Simulate records already created with database-generated IDs and a booking.
      db.exec("PRAGMA foreign_keys = ON");
      db.exec(
        "UPDATE workshop_time_slots SET id = 'existing-slot' WHERE id = 'workshop-geo-map-1'",
      );
      db.exec(
        "INSERT INTO users (id, google_id, email, name, role) VALUES ('user', 'google', 'test@example.com', 'Test', 'attendee')",
      );
      db.exec(
        "INSERT INTO attendees (id, qrCodeId, user_id, title, firstname, lastname, age, resident_province, type) VALUES ('attendee', 'qr', 'user', 'Mx', 'Test', 'User', 18, 'Bangkok', 'student')",
      );
      db.exec(
        "INSERT INTO workshop_registrations (id, workshop_time_slot_id, attendee_id, type) VALUES ('booking', 'existing-slot', 'attendee', 'advance')",
      );
      db.exec(
        "UPDATE workshops SET title = 'Old title' WHERE slug = 'geo-map'",
      );
      for (const statement of buildWorkshopSeedStatements()) db.exec(statement);

      expect(
        db.query("SELECT title FROM workshops WHERE slug = 'geo-map'").get(),
      ).toEqual({ title: "สำรวจเกาะ เจาะแผนที่" });
      expect(
        db
          .query(
            "SELECT workshop_time_slot_id FROM workshop_registrations WHERE id = 'booking'",
          )
          .get(),
      ).toEqual({ workshop_time_slot_id: "existing-slot" });
      expect(
        db.query("SELECT count(*) AS count FROM workshop_time_slots").get(),
      ).toEqual({ count: 40 });
      expect(
        db
          .query(
            "SELECT starts_at, ends_at FROM workshop_time_slots WHERE id = 'existing-slot'",
          )
          .get(),
      ).toEqual({
        starts_at: Date.parse("2026-10-31T13:00:00+07:00") / 1000,
        ends_at: Date.parse("2026-10-31T14:00:00+07:00") / 1000,
      });
      expect(db.query("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
      db.close();
    }
  });
});
