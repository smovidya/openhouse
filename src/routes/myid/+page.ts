import { getMyProgress } from "#lib/features/checkpoints/checkpoints.remote.ts";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ data }) => {
  // The reward cards' counts. Without them the page still works; the cards show "–".
  const progress = await getMyProgress().catch(() => null);
  return { ...data, progress, waterOverlay: 0.5 };
};
