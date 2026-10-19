import { listScannableCheckpoints } from "#lib/features/checkpoints/checkpoints.remote.ts";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  // The registration point ("entry") among the checkpoints this staff member may scan. Null when
  // there's none (no permission, or none set up): checking in then fails with a message.
  // TODO: access checks (403) once the staff permissions → pages mapping is decided.
  const checkpoints = await listScannableCheckpoints({});
  const entry =
    checkpoints.find((checkpoint) => checkpoint.type === "entry") ?? null;
  return { entry };
};
