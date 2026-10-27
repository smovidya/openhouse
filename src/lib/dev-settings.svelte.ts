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

/** Show the FPS counter overlay (see fps-counter.svelte). */
export const showFps = new PersistedState("dev:showFps", false);

/** TODO: placeholder for the staff role (/staff menu) until auth exists. */
export const fakeStaffRole = new PersistedState<StaffRole>(
  "dev:staffRole",
  "central",
);

/**
 * The water background: WebGPU caustics, looping ("animated") or a single frame ("still"), or the
 * static image ("image", no WebGPU water). Animation also stops with prefers-reduced-motion.
 */
export type BackgroundMode = "animated" | "still" | "image";
export const backgroundMode = new PersistedState<BackgroundMode>(
  "dev:background",
  "still",
);

/**
 * How <Glass> panes render (see GlassMode): "full" needs the WebGPU water, so with the static
 * background it falls back to "rim".
 */
export const glassMode = new PersistedState<GlassMode>("dev:glassMode", "full");

/** Mirror settings onto the document. Call once from the root layout. */
export function syncDevSettings() {
  $effect(() => {
    document.documentElement.dataset.blur = blurEnabled.current ? "on" : "off";
  });
}
