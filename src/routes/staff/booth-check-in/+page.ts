import { listScannableCheckpointsOf } from "#lib/checkpoints.js";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  // The booths this staff member may scan (by permission): department booths, TCAS, the central
  // activity, and the stage.
  return {
    checkpoints: await listScannableCheckpointsOf([
      "booth",
      "tcas",
      "central_activity",
      "stage",
    ]),
  };
};
