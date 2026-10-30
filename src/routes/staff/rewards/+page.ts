import { findScannableCheckpoint } from "#lib/checkpoints.js";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  // The reward point this staff member may scan. Null when there's none (no permission, or not
  // set up): redeeming then fails with a message.
  return { reward: await findScannableCheckpoint("reward") };
};
