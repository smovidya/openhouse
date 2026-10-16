import type { LayoutLoad } from "./$types";

// Every /staff/* page uses a navy tint over the water (Figma staff frames).
export const load: LayoutLoad = () => ({
	waterTint: "navy" as const,
	waterOverlay: 0.7,
});
