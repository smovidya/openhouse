import { listBoothHistory } from "#lib/features/checkpoints/checkpoints.remote.ts";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ url }) => {
  // The booth picked on the scanner page, else every booth this staff member may scan.
  const checkpointId = url.searchParams.get("checkpoint") ?? undefined;
  const checkins = await listBoothHistory({ checkpointId, limit: 100 });
  return { checkpointId, checkins };
};
