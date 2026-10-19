import { error, redirect } from "@sveltejs/kit";
import type { LayoutLoad } from "./$types";

export const load: LayoutLoad = async ({ parent, route }) => {
  // /staff itself signs people in and enrolls them with an invite code (see +page.svelte).
  // Every page under it is staff only: signed out → sign in on /staff; not staff → 403.
  if (route.id !== "/staff") {
    const { session } = await parent();
    if (!session) redirect(303, "/staff");
    if (!session.user.staff) error(403, "สำหรับเจ้าหน้าที่เท่านั้น");
  }
  // Every /staff/* page uses a navy tint over the water (Figma staff frames).
  return { waterTint: "navy" as const, waterOverlay: 0.7 };
};
