import { error } from "@sveltejs/kit";
import { getWorkshopBySlug } from "#lib/features/workshops/workshops.remote.ts";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  const result = await getWorkshopBySlug(params.id);
  if (result.isErr()) error(503, "ไม่สามารถโหลดเวิร์กช็อปได้ กรุณาลองอีกครั้ง");
  if (!result.value) error(404, "ไม่พบเวิร์กช็อป");
  return { waterOverlay: 0.5, workshopSlug: params.id };
};
