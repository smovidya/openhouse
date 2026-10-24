import { error, redirect } from "@sveltejs/kit";
import type { LayoutLoad } from "./$types";

export const load: LayoutLoad = async ({ parent, route }) => {
  // /staff accepts signup before an invite; pending profiles have no staff access.
  // Every page under it is staff only: signed out → sign in on /staff; not staff → 403.
  if (route.id !== "/staff") {
    const { session } = await parent();
    if (!session) redirect(303, "/staff");
    if (!session.user.staff) error(403, "สำหรับเจ้าหน้าที่เท่านั้น");
  }
  // Every /staff/* page uses a navy tint over the water (Figma staff frames).
  // The dashboards need a dimmer backdrop for the dark mission-control panels.
  return {
    waterTint: "navy" as const,
    waterOverlay:
      route.id === "/staff/dashboard" || route.id === "/staff/dashboard/bento"
        ? 0.9
        : 0.7,
  };
};
