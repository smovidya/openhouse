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

/** Every checkpoint of `types` this staff member may scan, across all pages, by name. */
export async function listScannableCheckpointsOf(
  types: readonly Checkpoint["type"][],
): Promise<Checkpoint[]> {
  const limit = 100;
  const found: Checkpoint[] = [];
  for (let offset = 0; ; offset += limit) {
    const page = await listScannableCheckpoints({ offset, limit });
    found.push(...page.filter((checkpoint) => types.includes(checkpoint.type)));
    if (page.length < limit) break;
  }
  return found.sort((a, b) =>
    (a.name ?? a.id).localeCompare(b.name ?? b.id, "th"),
  );
}
