import type { FramePlan, GlassMode, PaneSnapshot } from "./frame-plan.js";
import {
  DEFAULT_GLASS_OPTIONS,
  type GlassOptions,
  type GlassVariant,
} from "./shaders/liquid-glass.js";

/**
 * Global liquid-glass settings, read by the water background every frame.
 * - `blur` is global by design: every pane samples one shared Dual Kawase texture (approximate
 *   Gaussian-equivalent sigma, CSS px; downsampling adds minimum softness).
 *   Changing it re-blurs the water.
 * - `defaults` apply to every <Glass>; a pane's `options` prop overrides them.
 */
export const liquidGlassConfig = $state({
  blur: 10,
  defaults: { ...DEFAULT_GLASS_OPTIONS } as GlassOptions,
});

/**
 * What the water background is actually serving, once its WebGPU renderer is up (reset on teardown
 * or failure): `mode` is the glass mode ("css" until then; <Glass> panes read it to mount their
 * canvas), `water` whether the page shows the WebGPU water rather than the static image.
 */
export const glassRenderer = $state({ mode: "css" as GlassMode, water: false });

// ── Redraw scheduling ────────────────────────────────────────────────────────────────────────
// The water background only renders when something changed. Anything that can move or change a
// pane calls requestGlassRedraw(); the background registers the actual scheduler.

let redraw: (() => void) | null = null;

/** Called by the water background with its frame scheduler (null on teardown). */
export function setGlassRedrawHandler(handler: (() => void) | null) {
  redraw = handler;
}

export function requestGlassRedraw() {
  redraw?.();
}

// ── Pane registry ────────────────────────────────────────────────────────────────────────────

/**
 * One <Glass> pane. It draws into its own canvas (a child of the pane element), so the
 * compositor scrolls the glass together with the card.
 */
export class GlassPaneState {
  /** Its canvas holds a frame: the pane may drop its CSS look. Reset when GPU state is dropped. */
  drawn = $state(false);

  element: HTMLElement | null = null;
  canvas: HTMLCanvasElement | null = null;
  context: GPUCanvasContext | null = null;
  /** Device the context is configured with; reconfigure when it changes. */
  device: GPUDevice | null = null;
  /** Cached corner radius (CSS px); cleared on resize. */
  radius: number | null = null;
  /**
   * Within half a viewport of the screen (IntersectionObserver); only these are measured and keep
   * GPU state. Others are released and show the CSS look.
   */
  near = false;
  /** The canvas must be redrawn regardless of keys (new, resized); cleared once drawn. */
  dirty = true;

  /** `getOptions`: the pane's `options` prop (overrides `liquidGlassConfig.defaults`). */
  constructor(readonly getOptions: () => Partial<GlassOptions> | undefined) {}

  /** Attachment for the pane's canvas; the pane is the canvas's parent element. */
  attach = (canvas: HTMLCanvasElement) => {
    const element = canvas.parentElement;
    if (!element) return;
    this.element = element;
    this.canvas = canvas;
    this.dirty = true;
    const { nearObserver, sizeObserver } = observers();
    panes.add(this);
    paneByElement.set(element, this);
    nearObserver.observe(element);
    sizeObserver.observe(element);
    if (layoutWatchers++ === 0) sizeObserver.observe(document.body);
    requestGlassRedraw();
    return () => {
      nearObserver.unobserve(element);
      sizeObserver.unobserve(element);
      if (--layoutWatchers === 0) sizeObserver.unobserve(document.body);
      this.release();
      panes.delete(this);
      paneByElement.delete(element);
      this.element = this.canvas = null;
      requestGlassRedraw();
    };
  };

  /** Drop GPU state (canvas unmounted, device lost or recreated). */
  release() {
    this.context?.unconfigure();
    this.context = null;
    this.device = null;
    this.dirty = true;
    this.drawn = false;
  }
}

const panes = new Set<GlassPaneState>();
const paneByElement = new WeakMap<Element, GlassPaneState>();

// Shared observers, created lazily (browser only).
let nearObserver: IntersectionObserver | undefined;
let sizeObserver: ResizeObserver | undefined;
let layoutWatchers = 0;

function observers() {
  // Panes are measured a little before they scroll in (observer callbacks lag a frame), but only
  // drawn once they are actually on screen.
  nearObserver ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const pane = paneByElement.get(entry.target);
        if (!pane) continue;
        pane.near = entry.isIntersecting;
        // Far away: free its canvas's GPU textures and fall back to the CSS look until it's near again.
        if (!pane.near) pane.release();
      }
      requestGlassRedraw();
    },
    { rootMargin: "50% 0px 50% 0px" },
  );
  sizeObserver ??= new ResizeObserver((entries) => {
    for (const entry of entries) {
      const pane = paneByElement.get(entry.target);
      if (pane) {
        pane.radius = null;
        pane.dirty = true;
      }
    }
    // Also fires for <body>: content above a pane grew or shrank, so panes may have moved.
    requestGlassRedraw();
  });
  return { nearObserver, sizeObserver };
}

// ── Frame phases (see frame-plan.ts) ─────────────────────────────────────────────────────────

/**
 * Prepare: measure every pane near the viewport and get its canvas ready (sized, configured).
 * The only phase that touches the DOM.
 */
export function snapshotPanes(
  device: GPUDevice,
  format: GPUTextureFormat,
  dpr: number,
) {
  const snapshots: PaneSnapshot[] = [];
  const vw = innerWidth;
  const vh = innerHeight;
  for (const pane of panes) {
    const { element, canvas } = pane;
    // Far panes (beyond one viewport of margin) aren't even measured.
    if (!pane.near || !element || !canvas) continue;
    const box = element.getBoundingClientRect();
    const width = Math.max(1, Math.round(box.width * dpr));
    const height = Math.max(1, Math.round(box.height * dpr));
    let cleared = pane.dirty;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      cleared = true;
    }
    pane.context ??= canvas.getContext("webgpu");
    if (!pane.context) continue;
    if (pane.device !== device) {
      pane.context.configure({ device, format, alphaMode: "premultiplied" });
      pane.device = device;
      cleared = true;
    }
    pane.radius ??=
      parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
    const overrides = pane.getOptions();
    snapshots.push({
      id: pane,
      context: pane.context,
      rect: { x: box.left * dpr, y: box.top * dpr, width, height },
      radius: pane.radius * dpr,
      variant: (element.dataset.glass === "light"
        ? "light"
        : "dark") satisfies GlassVariant,
      options: overrides
        ? { ...liquidGlassConfig.defaults, ...overrides }
        : liquidGlassConfig.defaults,
      onScreen:
        box.bottom > 0 && box.top < vh && box.right > 0 && box.left < vw,
      cleared,
    });
  }
  return snapshots;
}

/** After commit: these canvases hold a current frame; their panes can drop the CSS look. */
export function markPanesDrawn(plan: FramePlan) {
  for (const { id } of plan.panes) {
    const pane = id as GlassPaneState;
    pane.dirty = false;
    pane.drawn = true;
  }
}

/** Force every pane to redraw (viewport resized; radii can be responsive). */
export function invalidateGlassPanes() {
  for (const pane of panes) {
    pane.radius = null;
    pane.dirty = true;
  }
}

/** Drop every pane's GPU state (renderer torn down). */
export function releaseGlassPanes() {
  for (const pane of panes) pane.release();
}
