import type { PageLoad } from "./$types";

export const load: PageLoad = () => ({
	// Figma landing frame uses a lighter sky tint over the water.
	waterOverlay: 0.5,
});
