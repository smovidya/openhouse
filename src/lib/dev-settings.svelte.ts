import { PersistedState } from "runed";

// Dev-only toggles, persisted per browser in localStorage. Edited on /settings.

/** When false, every backdrop-filter is disabled via `data-blur="off"` (see layout.css). */
export const blurEnabled = new PersistedState("dev:blur", true);

/** TODO: placeholder for the navbar's logged-in variant until auth exists. */
export const fakeLoggedIn = new PersistedState("dev:loggedIn", false);

/** Mirror settings onto the document. Call once from the root layout. */
export function syncDevSettings() {
	$effect(() => {
		document.documentElement.dataset.blur = blurEnabled.current ? "on" : "off";
	});
}
