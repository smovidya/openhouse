import { error, redirect } from "@sveltejs/kit";
import type { LayoutLoad } from "./$types";

export const load: LayoutLoad = async ({ parent }) => {
  // Staff only: signed out → sign in on the landing page; signed in without a staff record → 403.
  const { session } = await parent();
  if (!session) redirect(303, "/#register");
  if (!session.user.staff) error(403, "สำหรับเจ้าหน้าที่เท่านั้น");
  // Every /staff/* page uses a navy tint over the water (Figma staff frames).
  return { waterTint: "navy" as const, waterOverlay: 0.7 };
};
