import { listScannableCheckpoints } from "#lib/features/checkpoints/checkpoints.remote.ts";

type Checkpoint = Awaited<ReturnType<typeof listScannableCheckpoints>>[number];

/**
 * The first checkpoint of `type` this staff member may scan, or null. Pages through
 * listScannableCheckpoints: one page (sorted by id) can be filled by booths and workshop rounds.
 */
export async function findScannableCheckpoint(
  type: Checkpoint["type"],
): Promise<Checkpoint | null> {
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const page = await listScannableCheckpoints({ offset, limit });
    const found = page.find((checkpoint) => checkpoint.type === type);
    if (found) return found;
    if (page.length < limit) return null;
  }
}
