// The reward hunt's tiers as attendees see them. The rules are the backend's (tierRequirements):
// every tier needs TCAS and the central activity, plus department booths, workshops and the
// stage. Tier 3 is the easiest; an attendee redeems once, for the highest tier reached, and is
// then locked. Names and gifts are from the reward point's staff protocol.
import {
  tierRequirements,
  type ProgressCounts,
  type RewardTier,
} from "#lib/features/checkpoints/progress.ts";

type TierRequirement = (typeof tierRequirements)[number];

const tierInfo = {
  3: { title: "ลูกเรือโจรสลัด", rewards: ["หมอนเสืออ้วน"] },
  2: { title: "รองหัวหน้าโจรสลัด", rewards: ["หมวกแก๊ป"] },
  1: { title: "กัปตันโจรสลัด", rewards: ["กระบอกน้ำเก็บความเย็น"] },
} as const satisfies Record<
  RewardTier,
  { title: string; rewards: readonly string[] }
>;

/** Easiest first, as /myid lists them. */
export const rewardTiers = [...tierRequirements]
  .sort((a, b) => b.tier - a.tier)
  .map((requirement) => ({ ...requirement, ...tierInfo[requirement.tier] }));

/** Handed out at the registration point on entry, before any tier. */
export const entryReward = "สมุดและกระเป๋า";

/** Hashtags the attendee's story must carry before staff hand over a tier reward. */
export const rewardHashtags = [
  "#SCICUOPENHOUSE2027",
  "#JOURNEYTOSCILAND",
] as const;

/** `done` is null when progress couldn't be loaded. */
export type TierCondition = {
  label: string;
  done: number | null;
  total: number;
};

/** A tier's conditions with the attendee's progress on each (done is capped at total). */
export function tierConditions(
  requirement: TierRequirement,
  counts: ProgressCounts | null,
): TierCondition[] {
  const condition = (
    label: string,
    done: (counts: ProgressCounts) => number,
    total: number,
  ) => ({ label, done: counts && Math.min(done(counts), total), total });
  return [
    condition("บูธ TCAS", (c) => Number(c.hasTcas), 1),
    condition("กิจกรรมกลาง", (c) => Number(c.hasCentralActivity), 1),
    condition("บูธภาควิชา", (c) => c.departmentCount, requirement.departments),
    ...(requirement.workshops > 0
      ? [condition("เวิร์คช็อป", (c) => c.workshopCount, requirement.workshops)]
      : []),
    ...(requirement.stage
      ? [condition("กิจกรรมเวที", (c) => Number(c.hasStage), 1)]
      : []),
  ];
}
