import { error } from "@sveltejs/kit";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "#db";
import {
  attendees,
  checkpointLogs,
  checkpoints,
  rewardGifts,
  rewardRedemptions,
  users,
  type RewardProgressSnapshot,
} from "#db/tables.ts";
import { requirePermission } from "../auth/guards.server";
import { findSessionUser } from "../auth/service.server";
import { findAttendeeByQrCode } from "../checkpoints/service.server";
import {
  eligibleTierSql,
  getAttendeeProgress,
  progressCountsQuery,
} from "../checkpoints/progress.server";
import type { RedeemRewardInput, SaveRewardGiftInput } from "./schemas";

export async function listRewardGifts(db: Db, actorId: string) {
  requirePermission(await findSessionUser(db, actorId), "activityStaff");
  return db
    .select()
    .from(rewardGifts)
    .orderBy(asc(rewardGifts.tier), asc(rewardGifts.name));
}

export async function saveRewardGift(
  db: Db,
  actorId: string,
  input: SaveRewardGiftInput,
) {
  requirePermission(await findSessionUser(db, actorId), "admin");
  const values = {
    name: input.name,
    tier: input.tier,
    deletedAt: input.enabled ? null : new Date(),
  };
  if (input.id) {
    const [gift] = await db
      .update(rewardGifts)
      .set(values)
      .where(eq(rewardGifts.id, input.id))
      .returning();
    if (!gift) error(404, "GIFT_NOT_FOUND");
    return gift;
  }
  const [gift] = await db.insert(rewardGifts).values(values).returning();
  return gift;
}

/** Every redemption at the event, newest first, with the attendee's name, age and status. */
export async function listRewardRedemptions(
  db: Db,
  actorId: string,
  input: { offset: number; limit: number },
) {
  requirePermission(await findSessionUser(db, actorId), "activityStaff");
  return db
    .select({
      id: rewardRedemptions.id,
      createdAt: rewardRedemptions.createdAt,
      tier: rewardRedemptions.tier,
      giftName: rewardRedemptions.giftName,
      firstname: attendees.firstname,
      lastname: attendees.lastname,
      age: attendees.age,
      type: attendees.type,
    })
    .from(rewardRedemptions)
    .innerJoin(attendees, eq(attendees.id, rewardRedemptions.attendeeId))
    .where(
      and(isNull(rewardRedemptions.deletedAt), isNull(attendees.deletedAt)),
    )
    .orderBy(desc(rewardRedemptions.createdAt), desc(rewardRedemptions.id))
    .offset(input.offset)
    .limit(input.limit);
}

export async function previewReward(
  db: Db,
  actorId: string,
  input: { qrCodeId: string },
) {
  requirePermission(await findSessionUser(db, actorId), "activityStaff");
  const attendee = await findAttendeeByQrCode(db, input.qrCodeId);
  const progress = await getAttendeeProgress(db, attendee.id);
  const gifts =
    progress.highestEligibleTier !== null &&
    !progress.redemption &&
    progress.entered
      ? await db
          .select({
            id: rewardGifts.id,
            name: rewardGifts.name,
            tier: rewardGifts.tier,
          })
          .from(rewardGifts)
          .where(
            and(
              eq(rewardGifts.tier, progress.highestEligibleTier),
              isNull(rewardGifts.deletedAt),
            ),
          )
          .orderBy(asc(rewardGifts.name))
      : [];
  return { attendee, progress, gifts, canRedeem: gifts.length > 0 };
}

export async function redeemReward(
  db: Db,
  actorId: string,
  input: RedeemRewardInput,
) {
  const actor = requirePermission(
    await findSessionUser(db, actorId),
    "activityStaff",
  );
  const attendee = await findAttendeeByQrCode(db, input.qrCodeId);
  const counts = progressCountsQuery(db, attendee.id).as("progress_counts");
  const tier = eligibleTierSql(counts);
  const candidate = db
    .select({
      attendeeId: sql<string>`${attendees.id}`.as("attendee_id"),
      checkpointId: sql<string>`${checkpoints.id}`.as("checkpoint_id"),
      giftId: sql<string>`${rewardGifts.id}`.as("gift_id"),
      giftName: rewardGifts.name,
      tier: tier.as("eligible_tier"),
      progressSnapshot: sql<RewardProgressSnapshot>`json_object(
      'departmentCount', ${counts.departmentCount}, 'workshopCount', ${counts.workshopCount},
      'hasTcas', json(case when ${counts.hasTcas} = 1 then 'true' else 'false' end),
      'hasCentralActivity', json(case when ${counts.hasCentralActivity} = 1 then 'true' else 'false' end),
      'hasStage', json(case when ${counts.hasStage} = 1 then 'true' else 'false' end)
    )`.as("progress_snapshot"),
      rejection: sql<string | null>`case
      when exists (select 1 from ${rewardRedemptions} where ${rewardRedemptions.attendeeId} = ${attendees.id} and ${rewardRedemptions.deletedAt} is null)
        then 'ALREADY_REDEEMED'
      when ${counts.entered} = 0 then 'ENTRY_REQUIRED'
      when ${tier} is null then 'REWARD_NOT_ELIGIBLE'
      when ${tier} <> ${input.expectedTier} then 'PROGRESS_CHANGED'
      when ${rewardGifts.tier} <> ${tier} then 'GIFT_TIER_MISMATCH'
      else null end`.as("rejection"),
    })
    .from(attendees)
    .innerJoin(users, eq(users.id, attendees.userId))
    .innerJoin(
      checkpoints,
      and(
        eq(checkpoints.id, input.checkpointId),
        eq(checkpoints.type, "reward"),
        isNull(checkpoints.deletedAt),
      ),
    )
    .innerJoin(
      rewardGifts,
      and(eq(rewardGifts.id, input.giftId), isNull(rewardGifts.deletedAt)),
    )
    .crossJoin(counts)
    .where(
      and(
        eq(attendees.id, attendee.id),
        isNull(attendees.deletedAt),
        isNull(users.deletedAt),
      ),
    )
    .as("candidate");
  const now = Math.floor(Date.now() / 1000);
  const redemptionId = crypto.randomUUID();
  const insert = db
    .insert(rewardRedemptions)
    .select(
      db
        .select({
          id: sql<string>`${redemptionId}`.as("id"),
          attendeeId: candidate.attendeeId,
          checkpointId: candidate.checkpointId,
          checkerId: sql<string>`${actor.staff.id}`.as("checker_id"),
          giftId: candidate.giftId,
          tier: candidate.tier,
          giftName: candidate.giftName,
          progressSnapshot: candidate.progressSnapshot,
          createdAt: sql<Date>`${now}`.as("created_at"),
          updatedAt: sql<Date>`${now}`.as("updated_at"),
          deletedAt: sql<null>`null`.as("deleted_at"),
        })
        .from(candidate)
        .where(isNull(candidate.rejection)),
    )
    .returning();
  // The journey log and handover record commit together. The generated ID
  // ensures a rejected or retried confirmation cannot add a new log.
  const recordHandover = db
    .insert(checkpointLogs)
    .select(
      db
        .select({
          id: sql<string>`${crypto.randomUUID()}`.as("id"),
          attendeeId: rewardRedemptions.attendeeId,
          checkpointId: rewardRedemptions.checkpointId,
          checkerId: rewardRedemptions.checkerId,
          workshopId: sql<null>`null`.as("workshop_id"),
          attendanceType: sql<null>`null`.as("attendance_type"),
          removedById: sql<null>`null`.as("removed_by_id"),
          removalReason: sql<null>`null`.as("removal_reason"),
          createdAt: sql<Date>`${now}`.as("created_at"),
          updatedAt: sql<Date>`${now}`.as("updated_at"),
          deletedAt: sql<null>`null`.as("deleted_at"),
        })
        .from(rewardRedemptions)
        .where(eq(rewardRedemptions.id, redemptionId)),
    )
    .onConflictDoNothing();
  const [candidates, redemptions] = await db.batch([
    db.select().from(candidate),
    insert,
    recordHandover,
  ]);
  if (!redemptions[0])
    error(409, candidates[0]?.rejection ?? "REWARD_SELECTION_UNAVAILABLE");
  return {
    attendee,
    redemption: redemptions[0],
    progress: await getAttendeeProgress(db, attendee.id),
  };
}
