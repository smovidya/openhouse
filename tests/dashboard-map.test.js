import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { venueWorkshopSchedule } from "../src/lib/features/dashboard/venue-workshops";
import { matchesMapBooth } from "../src/lib/features/dashboard/venue-map";
import { getDashboardFeed } from "../src/lib/features/dashboard/service.server";

describe("map checkpoint matching", () => {
  const checkpoint = {
    id: "seed",
    name: null,
    department: null,
    type: "booth",
    scans: 0,
  };

  it("matches abbreviated names/departments without requiring a canonical slug", () => {
    for (const [name, department] of [
      ["Inprint", "imaging-printing"],
      ["Chemtech", "chemical-technology"],
      ["Bistech", "bistech"],
      ["BBTech", "bbtech"],
      ["Bsac", "bsac"],
      ["Matsci", "materials-science"],
      ["Foodtech", "food-technology"],
      ["Micro", "microbiology"],
      ["Botgen", "botany"],
      ["Geo", "geology"],
      ["Marine", "marine-science"],
      ["Envi", "environmental-science"],
      ["Biochem", "biochemistry"],
      ["Biozoo", "biology"],
      ["Mathcom", "math-cs"],
      ["Chem", "chemistry"],
      ["Physics", "physics"],
    ]) {
      const location = { name, department };
      expect(
        matchesMapBooth({ ...checkpoint, name: name.toUpperCase() }, location),
      ).toBe(true);
      expect(
        matchesMapBooth(
          { ...checkpoint, department: name.toLowerCase() },
          location,
        ),
      ).toBe(true);
      expect(matchesMapBooth({ ...checkpoint, department }, location)).toBe(
        true,
      );
    }
    expect(
      matchesMapBooth(
        { ...checkpoint, name: "Chemthch" },
        { name: "Chemtech", department: "chemical-technology" },
      ),
    ).toBe(true);
    expect(
      matchesMapBooth(
        { ...checkpoint, name: "ชีวเคมี" },
        { name: "Biochem", department: "biochemistry" },
      ),
    ).toBe(true);
    expect(
      matchesMapBooth(
        { ...checkpoint, name: "Booth Math/Com" },
        { name: "Mathcom", department: "math-cs" },
      ),
    ).toBe(true);
  });

  it("does not confuse chemistry with other chemistry-related booths or non-booth checkpoints", () => {
    const location = { name: "Chem", department: "chemistry" };
    for (const name of ["Biochem", "Chemtech", "Bsac"]) {
      expect(matchesMapBooth({ ...checkpoint, name }, location)).toBe(false);
    }
    expect(
      matchesMapBooth({ ...checkpoint, name: "Chem", type: "tcas" }, location),
    ).toBe(false);
    expect(
      matchesMapBooth(
        { ...checkpoint, name: "Chem", department: "biochem" },
        location,
      ),
    ).toBe(false);
  });
});

describe("selected booth recent scans", () => {
  it("filters before limiting, orders newest first, and excludes deleted records", async () => {
    const sqlite = new Database(":memory:");
    try {
      // Only the columns this read uses; the query runs against real SQLite.
      sqlite.exec(`
        CREATE TABLE attendees (id TEXT, firstname TEXT, lastname TEXT, deleted_at INTEGER);
        CREATE TABLE checkpoints (id TEXT, name TEXT, type TEXT, deleted_at INTEGER);
        CREATE TABLE checkpoint_logs (id TEXT, attendee_id TEXT, checkpoint_id TEXT, created_at INTEGER, deleted_at INTEGER);
        INSERT INTO attendees VALUES ('a', 'First', 'Last', NULL), ('deleted', 'Deleted', 'Person', 1);
        INSERT INTO checkpoints VALUES ('quiet', 'Chem', 'booth', NULL), ('busy', 'Physics', 'booth', NULL), ('deleted', 'Removed', 'booth', 1);
        INSERT INTO checkpoint_logs VALUES
          ('old', 'a', 'quiet', 10, NULL), ('new', 'a', 'quiet', 20, NULL),
          ('busy-1', 'a', 'busy', 30, NULL), ('busy-2', 'a', 'busy', 40, NULL),
          ('removed-log', 'a', 'quiet', 50, 1), ('removed-person', 'deleted', 'quiet', 60, NULL),
          ('removed-booth', 'a', 'deleted', 70, NULL);
      `);
      const db = drizzle({ client: sqlite });
      const scans = await getDashboardFeed(db, 2, ["quiet", "deleted"]);
      expect(scans.map((scan) => scan.id)).toEqual(["new", "old"]);
      expect(scans[0]).toMatchObject({
        firstname: "First",
        lastnameInitial: "L.",
        checkpointName: "Chem",
        createdAt: "1970-01-01T00:00:20.000Z",
      });
      expect(await getDashboardFeed(db, 8, [])).toEqual([]);
      expect(await getDashboardFeed(db, 8, ["missing"])).toEqual([]);
    } finally {
      sqlite.close();
    }
  });
});

describe("workshop map schedule", () => {
  it("uses the supplied M/L groupings without assigning individual stations", () => {
    const now = Date.parse("2026-10-31T13:30:00+07:00");
    const m1 = venueWorkshopSchedule("M1", [], now);
    expect(venueWorkshopSchedule("M2", [], now)).toEqual(m1);
    expect(m1.map((w) => w.slug)).toEqual([
      "perfume",
      "behide-the-cookies",
      "dna-bracelet",
      "biochem-dna",
    ]);
    expect(venueWorkshopSchedule("L1", [], now).map((w) => w.slug)).toEqual([
      "geo-map",
      "little-beads-big-ideas",
      "mushroom-culture",
      "shrink-plastic",
      "art-meet-sci",
    ]);
    expect(
      m1
        .filter((w) => w.rounds.some((r) => r.status === "running"))
        .map((w) => w.slug),
    ).toEqual(["perfume", "behide-the-cookies", "dna-bracelet"]);
    expect(m1[0].rounds[0].registered).toBeNull();
  });

  it("uses live rounds and counts, with an exclusive end time", () => {
    const workshops = [
      {
        slug: "perfume",
        title: "Live perfume",
        hostDepartmentAbbr: "BSAC & CHEM",
        rounds: [
          {
            roundNumber: 1,
            startsAt: "2026-10-31T13:00:00+07:00",
            endsAt: "2026-10-31T14:00:00+07:00",
            advance: 8,
            walkIn: 2,
            capacity: 15,
          },
        ],
      },
    ];
    const at = (time) =>
      venueWorkshopSchedule("M1", workshops, Date.parse(time))[0];
    expect(at("2026-10-31T12:59:59+07:00").rounds[0].status).toBe("upcoming");
    expect(at("2026-10-31T13:00:00+07:00").rounds[0]).toMatchObject({
      status: "running",
      registered: 10,
      capacity: 15,
    });
    expect(at("2026-10-31T14:00:00+07:00").rounds[0].status).toBe("ended");
    expect(at("2026-10-31T13:30:00+07:00").title).toBe("Live perfume");
  });
});
