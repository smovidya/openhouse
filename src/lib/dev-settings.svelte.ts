import { PersistedState } from "runed";
import type { GlassMode } from "#lib/render/frame-plan.js";
import type { StaffRole } from "#lib/staff.js";

export const toolbarPositions = [
  "bottom-center",
  "bottom-left",
  "bottom-right",
  "top-center",
  "top-left",
  "top-right",
] as const;
export const toolbarPosition = new PersistedState<
  (typeof toolbarPositions)[number]
>("dev:toolbarPosition", "bottom-center");

// Dev-only toggles, persisted per browser in localStorage. Edited in the dev toolbar.

/** When false, every backdrop-filter is disabled via `data-blur="off"` (see layout.css). */
export const blurEnabled = new PersistedState("dev:blur", true);

/** TODO: placeholder for the staff role (/staff menu) until auth exists. */
export const fakeStaffRole = new PersistedState<StaffRole>(
  "dev:staffRole",
  "central",
);

/** Render the water background with WebGPU; false forces the static image fallback. */
export const useWebGPU = new PersistedState("dev:useWebGPU", true);

/**
 * How <Glass> panes render (see GlassMode): "full" needs the WebGPU water, so with the static
 * background it falls back to "rim".
 */
export const glassMode = new PersistedState<GlassMode>("dev:glassMode", "full");

/** Animate the WebGPU water (ignored with prefers-reduced-motion). */
export const animatedWater = new PersistedState("dev:animatedWater", false);

/** Mirror settings onto the document. Call once from the root layout. */
export function syncDevSettings() {
  $effect(() => {
    document.documentElement.dataset.blur = blurEnabled.current ? "on" : "off";
  });
}
