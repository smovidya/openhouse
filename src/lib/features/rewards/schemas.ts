import { z } from "zod";

export const rewardTierInput = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

export const previewRewardInput = z.strictObject({
  qrCodeId: z.string().min(1).max(128),
});

// Confirmation must name the gift and the tier shown in the preview. If progress
// changed while staff were choosing a gift, require a fresh preview.
export const redeemRewardInput = previewRewardInput.extend({
  checkpointId: z.string().min(1).max(128),
  giftId: z.string().min(1).max(128),
  expectedTier: rewardTierInput,
});
export type RedeemRewardInput = z.infer<typeof redeemRewardInput>;

export const saveRewardGiftInput = z.strictObject({
  id: z.string().min(1).max(128).optional(),
  name: z.string().trim().min(1).max(200),
  tier: rewardTierInput,
  enabled: z.boolean().default(true),
});
export type SaveRewardGiftInput = z.infer<typeof saveRewardGiftInput>;

export const listRedemptionsInput = z.strictObject({
  offset: z.int().nonnegative().default(0),
  limit: z.int().min(1).max(100).default(50),
});
