import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import {
  sessionStatus,
  sessionId,
  toBookedSession,
  toWorkshop,
} from "../src/lib/workshops";
import { workshopCatalog } from "../src/lib/data/workshops";

const session = (workshop, start, end, department = workshop, round = 1) => ({
  id: sessionId(workshop, round),
  workshop,
  department,
  round,
  start: `2026-10-31T${start}:00+07:00`,
  end: `2026-10-31T${end}:00+07:00`,
  registered: 0,
  capacity: 20,
});

describe("workshop attendee rules", () => {
  const booked = session("geo", "13:00", "14:00", "GEO");

  it("allows exactly 60 minutes after the previous end, and rejects shorter gaps", () => {
    assert.equal(
      sessionStatus(session("micro", "15:00", "16:00"), [booked]),
      "available",
    );
    for (const [start, end] of [
      ["14:59", "15:59"],
      ["14:00", "15:00"],
      ["13:30", "14:30"],
    ]) {
      assert.equal(
        sessionStatus(session("micro", start, end), [booked]),
        "conflict",
      );
    }
  });

  it("enforces the gap when the earlier workshop is selected second", () => {
    assert.equal(
      sessionStatus(session("micro", "11:00", "12:00"), [booked]),
      "available",
    );
    assert.equal(
      sessionStatus(session("micro", "11:01", "12:01"), [booked]),
      "conflict",
    );
  });

  it("blocks the same department on another day but keeps own-round cancellation available", () => {
    const tomorrow = {
      ...session("another-geo", "15:00", "16:00", "GEO"),
      start: "2026-11-01T15:00:00+07:00",
      end: "2026-11-01T16:00:00+07:00",
    };
    assert.equal(sessionStatus(tomorrow, [booked]), "same-department");
    assert.equal(
      sessionStatus(session("geo", "15:00", "16:00", "GEO", 2), [booked]),
      "other-round",
    );
    assert.equal(sessionStatus(booked, [booked]), "registered");
  });

  it("gets department identity from D1 for both candidate and booked sessions", () => {
    const workshop = toWorkshop({
      slug: "test",
      title: "Test",
      hostDepartment: "Test",
      hostDepartimentAbbr: "GEO",
      description: "",
      capacity: 10,
      timeSlots: [
        {
          roundNumber: 1,
          startsAt: new Date(booked.start),
          endsAt: new Date(booked.end),
          registeredCount: 0,
        },
      ],
    });
    const registration = toBookedSession({
      workshopSlug: "another-geo",
      workshopRoundNumber: 1,
      departmentAbbr: "GEO",
      startsAt: new Date("2026-11-01T15:00:00+07:00"),
      endsAt: new Date("2026-11-01T16:00:00+07:00"),
    });
    assert.equal(
      sessionStatus(workshop.sessions[0], [registration]),
      "same-department",
    );
  });

  it("keeps the nine workshops inside the supplied daily hours and updates the papaya title", () => {
    assert.equal(workshopCatalog.length, 9);
    assert.equal(
      workshopCatalog.find((workshop) => workshop.slug === "biochem-dna").title,
      "Papaya POK POK",
    );
    for (const workshop of workshopCatalog) {
      for (const round of workshop.sessions) {
        const day = round.start.slice(0, 10);
        const [opens, closes] =
          day === "2026-10-31" ? ["13:00", "19:00"] : ["09:00", "17:00"];
        assert.ok(["2026-10-31", "2026-11-01"].includes(day));
        assert.ok(
          Date.parse(round.start) >= Date.parse(`${day}T${opens}:00+07:00`),
        );
        assert.ok(
          Date.parse(round.end) <= Date.parse(`${day}T${closes}:00+07:00`),
        );
      }
    }
  });
});
