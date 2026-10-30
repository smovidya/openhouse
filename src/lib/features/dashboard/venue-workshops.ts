import { workshopCatalog } from "#lib/data/workshops.ts";
import type { WorkshopStats } from "./types";

export type WorkshopPlace = "M1" | "M2" | "L1" | "L2";

const placement = {
  M: [
    { slug: "perfume", activity: "น้ำหอม" },
    {
      slug: "behide-the-cookies",
      activity: "อบคุกกี้ เปรียบเทียบผงฟูกับ baking soda",
    },
    { slug: "dna-bracelet", activity: "กำไล / พวงกุญแจ codon code" },
    { slug: "biochem-dna", activity: "สกัด DNA · Papaya POK POK" },
  ],
  L: [
    { slug: "geo-map", activity: "ทำแผนที่ธรณีวิทยา" },
    { slug: "little-beads-big-ideas", activity: "เม็ดบีทรีดร้อนผจญภัยแสนสนุก" },
    { slug: "mushroom-culture", activity: "Mushroom culture" },
    { slug: "shrink-plastic", activity: "พวงกุญแจ shrink plastic" },
    { slug: "art-meet-sci", activity: "Art Meet Sci" },
  ],
};

export function venueWorkshopSchedule(
  place: WorkshopPlace,
  workshops: WorkshopStats[],
  now: number,
) {
  const group = place.startsWith("M") ? "M" : "L";
  return placement[group].map(({ slug, activity }) => {
    const info = workshopCatalog.find((workshop) => workshop.slug === slug)!;
    const live = workshops.find((workshop) => workshop.slug === slug);
    const rounds = (
      live
        ? live.rounds
        : info.sessions.map((session, index) => ({
            roundNumber: index + 1,
            startsAt: session.start,
            endsAt: session.end,
            capacity: info.capacity,
            advance: null,
            walkIn: null,
          }))
    )
      .map((round) => ({
        ...round,
        registered:
          round.advance === null || round.walkIn === null
            ? null
            : round.advance + round.walkIn,
        status:
          now < Date.parse(round.startsAt)
            ? "upcoming"
            : now < Date.parse(round.endsAt)
              ? "running"
              : "ended",
      }))
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    return {
      slug,
      activity,
      title: live?.title ?? info.title,
      host: live?.hostDepartmentAbbr ?? info.hostDepartmentAbbr,
      description: info.description,
      rounds,
    };
  });
}
