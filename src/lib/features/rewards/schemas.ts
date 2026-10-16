import { z } from "zod";

export const redeemRewardInput = z.strictObject({
  qrCodeId: z.string().min(1),
  checkpointId: z.string().min(1),
});

export type RedeemRewardInput = z.infer<typeof redeemRewardInput>;
