import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "#db";
import {
  attendees,
  checkpoints,
  checkpointLogs,
  rewardRedemptions,
} from "#db/tables.ts";
import {
  souvenirTiers,
  souvenirTierForCheckpoint,
  type SouvenirStats,
} from "./souvenirs";

export async function getSouvenirStats(db: Db): Promise<SouvenirStats> {
  const rewards = await db
    .select({ id: checkpoints.id, name: checkpoints.name })
    .from(checkpoints)
    .where(and(eq(checkpoints.type, "reward"), isNull(checkpoints.deletedAt)));
  const mapped = rewards.map((reward) => ({
    ...reward,
    tier: souvenirTierForCheckpoint(reward.name),
  }));
  const tierCase = sql`case ${sql.join(
    mapped
      .filter((reward) => reward.tier)
      .map(
        (reward) =>
          sql`when ${rewardRedemptions.checkpointId} = ${reward.id} then ${reward.tier}`,
      ),
    sql` `,
  )} else 'unmapped' end`;
  const [eligible, redeemed] = await Promise.all([
    db.all<{ basic: number; tier3: number; tier2: number; tier1: number }>(sql`
      with progress as (
        select ${attendees.id} as attendee_id,
          max(case when ${checkpoints.type} = 'entry' then 1 else 0 end) as entered,
          max(case when ${checkpoints.type} = 'tcas' then 1 else 0 end) as tcas,
          max(case when ${checkpoints.type} = 'central_activity' then 1 else 0 end) as central,
          count(distinct case when ${checkpoints.type} = 'booth' then coalesce(nullif(trim(${checkpoints.department}), ''), ${checkpoints.id}) end) as booths,
          count(distinct case when ${checkpoints.type} = 'workshop' then ${checkpoints.id} end) as workshops,
          max(case when ${checkpoints.type} = 'stage' then 1 else 0 end) as stage
        from ${attendees}
        left join ${checkpointLogs} on ${checkpointLogs.attendeeId} = ${attendees.id} and ${checkpointLogs.deletedAt} is null
        left join ${checkpoints} on ${checkpoints.id} = ${checkpointLogs.checkpointId} and ${checkpoints.deletedAt} is null
        where ${attendees.deletedAt} is null
        group by ${attendees.id}
      )
      select coalesce(sum(entered), 0) as basic,
        coalesce(sum(tcas = 1 and central = 1 and booths >= 6), 0) as tier3,
        coalesce(sum(tcas = 1 and central = 1 and booths >= 12 and workshops >= 1), 0) as tier2,
        coalesce(sum(tcas = 1 and central = 1 and booths >= 17 and workshops >= 2 and stage = 1), 0) as tier1
      from progress
    `),
    db
      .select({
        tier: mapped.some((reward) => reward.tier) ? tierCase : sql`'unmapped'`,
        count:
          sql<number>`count(distinct ${rewardRedemptions.attendeeId})`.mapWith(
            Number,
          ),
      })
      .from(rewardRedemptions)
      .innerJoin(attendees, eq(attendees.id, rewardRedemptions.attendeeId))
      .innerJoin(
        checkpoints,
        eq(checkpoints.id, rewardRedemptions.checkpointId),
      )
      .where(
        and(
          isNull(rewardRedemptions.deletedAt),
          isNull(attendees.deletedAt),
          isNull(checkpoints.deletedAt),
        ),
      )
      .groupBy(
        mapped.some((reward) => reward.tier) ? tierCase : sql`'unmapped'`,
      ),
  ]);
  return {
    tiers: souvenirTiers.map((tier) => ({
      id: tier.id,
      eligible: Number(eligible[0]?.[tier.id] ?? 0),
      redeemed: mapped.some((reward) => reward.tier === tier.id)
        ? (redeemed.find((row) => row.tier === tier.id)?.count ?? 0)
        : null,
    })),
    unmappedCheckpoints: mapped
      .filter((reward) => !reward.tier)
      .map((reward) => reward.name ?? reward.id),
    unmappedRedemptions:
      redeemed.find((row) => row.tier === "unmapped")?.count ?? 0,
    updatedAt: new Date().toISOString(),
  };
}
