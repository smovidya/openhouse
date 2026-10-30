import { findScannableCheckpoint } from "#lib/checkpoints.js";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  // The registration point ("entry") this staff member may scan. Null when there's none (no
  // permission, or none set up): checking in then fails with a message.
  return { entry: await findScannableCheckpoint("entry") };
};
