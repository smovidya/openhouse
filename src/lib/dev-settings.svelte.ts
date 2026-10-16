import { PersistedState } from "runed";
import type { StaffRole } from "#lib/staff.js";

// Dev-only toggles, persisted per browser in localStorage. Edited on /settings.

/** When false, every backdrop-filter is disabled via `data-blur="off"` (see layout.css). */
export const blurEnabled = new PersistedState("dev:blur", true);

/** TODO: placeholder for the navbar's logged-in variant until auth exists. */
export const fakeLoggedIn = new PersistedState("dev:loggedIn", false);

/** TODO: placeholder for the staff role (/staff menu) until auth exists. */
export const fakeStaffRole = new PersistedState<StaffRole>("dev:staffRole", "central");

/** Render the water background with WebGPU; false forces the static image fallback. */
export const useWebGPU = new PersistedState("dev:useWebGPU", true);

/** Refract the water under <Glass> panes in WebGPU instead of CSS backdrop blur. */
export const liquidGlass = new PersistedState("dev:liquidGlass", true);

/** Animate the WebGPU water (ignored with prefers-reduced-motion). */
export const animatedWater = new PersistedState("dev:animatedWater", false);

/** Mirror settings onto the document. Call once from the root layout. */
export function syncDevSettings() {
	$effect(() => {
		document.documentElement.dataset.blur = blurEnabled.current ? "on" : "off";
	});
}
