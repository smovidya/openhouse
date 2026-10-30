import { listRewardRedemptions } from "#lib/features/rewards/rewards.remote.ts";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  // Event-wide, newest first: the latest 100.
  return { redemptions: await listRewardRedemptions({ limit: 100 }) };
};
