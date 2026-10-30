import { listScannableCheckpointsOf } from "#lib/checkpoints.js";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  // The reward points this staff member may scan: one per tier (checkpoints:seed) or a single
  // one (booths:seed). None (no permission, or not set up): redeeming fails with a message.
  return { rewardPoints: await listScannableCheckpointsOf(["reward"]) };
};
