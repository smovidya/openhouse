import type { GlassOptions, GlassPane, Rgba } from "./shaders/liquid-glass.js";

/**
 * The water background's frame, in four phases (see water-background.svelte):
 *   1. prepare  — DOM reads and surface setup → FrameInputs
 *   2. plan     — planFrame(inputs, history): which passes this frame needs → FramePlan
 *   3. execute  — renderer.execute(plan): one command encoder, one submit
 *   4. commit   — commitFrame(history, plan): remember what is now on screen
 *
 * Planning is pure: every target's contents are identified by a key built from everything they
 * depend on, and a pass runs only when its target's key changed. Keys chain (water → blur → glass),
 * so invalidating the water re-blurs and redraws whatever shows it.
 */

/** Water renders at this fraction of device px per axis; the canvases upscale it (linear). */
export const WATER_RESOLUTION = 0.5;
/**
 * …but at most this many px per CSS px: a dpr 2.75 phone would otherwise render more water than
 * a desktop, on a far weaker GPU.
 */
export const WATER_MAX_PER_CSS_PX = 1;
/** One full caustic cycle when animated. */
export const WATER_LOOP_MS = 100_000;
/** Animated water steps at this rate: the loop is slow enough that 30 fps looks the same as 60+. */
export const WATER_FPS = 30;

/** Water px per device px. */
export const waterScale = (dpr: number) =>
  Math.min(WATER_RESOLUTION, WATER_MAX_PER_CSS_PX / dpr);

/** Water (and page canvas) size for a viewport in device px. */
export const waterSize = (width: number, height: number, dpr: number) => ({
  width: Math.max(1, Math.ceil(width * waterScale(dpr))),
  height: Math.max(1, Math.ceil(height * waterScale(dpr))),
});

/**
 * How <Glass> panes render:
 *   full — WebGPU draws the whole pane: refracted, frosted water + fill + rim (needs the WebGPU water)
 *   rim  — WebGPU draws only the rim highlight; CSS keeps the backdrop blur and fill
 *   css  — no WebGPU; the CSS fallback (blur, fill, masked rim)
 */
export type GlassMode = "full" | "rim" | "css";

/** A <Glass> pane, measured this frame. Only panes near the viewport are snapshotted. */
export type PaneSnapshot = {
  /** Stable identity across frames (the registry entry). */
  id: object;
  /** Its canvas, already sized to `rect` and configured for the device. */
  context: GPUCanvasContext;
  /** Viewport-relative, device px. */
  rect: Omit<GlassPane, "radius" | "variant">;
  radius: number;
  variant: GlassPane["variant"];
  options: GlassOptions;
  /** Intersects the viewport; panes off screen are never drawn. */
  onScreen: boolean;
  /** Its canvas was cleared (new, resized, reconfigured): draw it as soon as it is on screen. */
  cleared: boolean;
};

export type FrameInputs = {
  /** rAF timestamp, ms. */
  time: number;
  /** Page canvas, device px. */
  width: number;
  height: number;
  /** Device px per CSS px. */
  dpr: number;
  /** Draw the water into the page canvas (else the static image shows). */
  background: boolean;
  animate: boolean;
  glass: GlassMode;
  /** Frost, CSS px (approximate Gaussian sigma). */
  blurSigma: number;
  /** Page tint over the water: rgb + opacity. */
  tint: Rgba;
  panes: PaneSnapshot[];
};

export type FramePlan = {
  /** Water/blur render target size, device px; null when nothing samples the water. */
  water: { width: number; height: number } | null;
  /** Render the caustics at this phase (0–100), or keep last frame's. */
  caustics: { playhead: number } | null;
  /** Re-blur the water with this sigma (water px), or keep last frame's. */
  blur: { sigma: number } | null;
  /** Redraw the page canvas. */
  background: boolean;
  panes: PaneSnapshot[];
  inputs: FrameInputs;
  keys: {
    water: string;
    blur: string;
    background: string;
    panes: Map<object, string>;
  };
};

/** What each target holds after the last executed frame. Reset when the device is recreated. */
export type FrameHistory = {
  water: string;
  blur: string;
  background: string;
  panes: WeakMap<object, string>;
};

export const createFrameHistory = (): FrameHistory => ({
  water: "",
  blur: "",
  background: "",
  panes: new WeakMap(),
});

export function planFrame(
  inputs: FrameInputs,
  history: FrameHistory,
): FramePlan {
  const full = inputs.glass === "full";
  const water =
    inputs.background || full
      ? waterSize(inputs.width, inputs.height, inputs.dpr)
      : null;
  // Quantised to WATER_FPS: frames in between plan nothing and stay idle.
  const step = 1000 / WATER_FPS;
  const time = Math.floor(inputs.time / step) * step;
  const playhead = inputs.animate
    ? ((time % WATER_LOOP_MS) / WATER_LOOP_MS) * 100
    : 0;
  const sigma = inputs.blurSigma * inputs.dpr * waterScale(inputs.dpr);
  const tint = inputs.tint.join();

  // The target size is part of every key: resizing recreates (clears) the textures and canvas.
  const waterKey = water ? `${water.width}x${water.height}@${playhead}` : "";
  const blurKey = full ? `${waterKey}|${sigma}` : "";
  const backgroundKey = inputs.background
    ? `${waterKey}|${tint}|${inputs.width}x${inputs.height}`
    : "";

  const panes: PaneSnapshot[] = [];
  const paneKeys = new Map<object, string>();
  for (const pane of inputs.glass === "css" ? [] : inputs.panes) {
    const { x, y, width, height } = pane.rect;
    const { highlightWidth, highlightAlpha, highlightAngle } = pane.options;
    const shape = [width, height, pane.radius, pane.variant, inputs.dpr];
    const key = full
      ? // Full glass shows the fixed water behind it, so it also depends on where it is.
        [blurKey, tint, x, y, ...shape, ...Object.values(pane.options)].join()
      : [...shape, highlightWidth, highlightAlpha, highlightAngle].join();
    // Only what is on screen is drawn. A pane that scrolls in gets drawn in that same frame: full
    // glass because it moved (its key has its position), the rim if it changed meanwhile.
    if (pane.onScreen && (pane.cleared || history.panes.get(pane.id) !== key)) {
      panes.push(pane);
      paneKeys.set(pane.id, key);
    }
  }

  return {
    water,
    caustics: water && history.water !== waterKey ? { playhead } : null,
    blur: full && history.blur !== blurKey ? { sigma } : null,
    background: inputs.background && history.background !== backgroundKey,
    panes,
    inputs,
    keys: {
      water: waterKey,
      blur: blurKey,
      background: backgroundKey,
      panes: paneKeys,
    },
  };
}

export const isIdle = (plan: FramePlan) =>
  !plan.caustics && !plan.blur && !plan.background && !plan.panes.length;

export function commitFrame(history: FrameHistory, plan: FramePlan) {
  history.water = plan.keys.water;
  history.blur = plan.keys.blur;
  history.background = plan.keys.background;
  for (const [id, key] of plan.keys.panes) history.panes.set(id, key);
}
