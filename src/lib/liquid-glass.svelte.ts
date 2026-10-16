import {
	DEFAULT_GLASS_OPTIONS,
	type GlassOptions,
	type GlassVariant,
} from "#lib/shaders/liquid-glass.js";

/**
 * Global liquid-glass settings, read by the water background every frame.
 * - `blur` is global by design: every pane samples one shared pre-blurred texture (Gaussian
 *   sigma, CSS px). Changing it re-blurs the water.
 * - `defaults` apply to every <Glass>; a pane's `options` prop overrides them.
 */
export const liquidGlassConfig = $state({
	blur: 10,
	defaults: { ...DEFAULT_GLASS_OPTIONS } as GlassOptions,
});

/**
 * A <Glass> pane rendered by the water background. Each pane draws into its own canvas (a child
 * of the pane element), so the compositor scrolls the glass together with the card.
 */
export type GlassPaneState = {
	element: HTMLElement;
	canvas: HTMLCanvasElement;
	/** The pane's `options` prop (overrides `liquidGlassConfig.defaults`). */
	getOptions: () => Partial<GlassOptions> | undefined;
	context: GPUCanvasContext | null;
	/** Device the context is configured with; reconfigure when it changes. */
	device: GPUDevice | null;
	/** Cached corner radius (CSS px); cleared on resize. */
	radius: number | null;
	/** Within one viewport of the screen (IntersectionObserver); far panes are skipped entirely. */
	near: boolean;
	/** Must redraw regardless of what moved (new, resized, device changed). */
	dirty: boolean;
	// Inputs of the last draw.
	x: number;
	y: number;
	sceneVersion: number;
	optionsKey: string;
};

const panes = new Set<GlassPaneState>();

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

// Shared observers, created lazily (browser only).
let nearObserver: IntersectionObserver | undefined;
let sizeObserver: ResizeObserver | undefined;
const paneByElement = new WeakMap<Element, GlassPaneState>();

function observers() {
	// One viewport of margin above/below: panes there are pre-rendered before they scroll in.
	nearObserver ??= new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				const pane = paneByElement.get(entry.target);
				if (!pane) continue;
				pane.near = entry.isIntersecting;
				if (pane.near) pane.dirty = true;
			}
			requestGlassRedraw();
		},
		{ rootMargin: "100% 0px 100% 0px" }
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

let layoutWatchers = 0;

/** Attachment factory for a pane's canvas; the pane is the canvas's parent element. */
export function registerGlass(getOptions: () => Partial<GlassOptions> | undefined) {
	return (canvas: HTMLCanvasElement) => {
		const element = canvas.parentElement;
		if (!element) return;
		const pane: GlassPaneState = {
			element,
			canvas,
			getOptions,
			context: null,
			device: null,
			radius: null,
			near: false,
			dirty: true,
			x: NaN,
			y: NaN,
			sceneVersion: -1,
			optionsKey: "",
		};
		const { nearObserver, sizeObserver } = observers();
		panes.add(pane);
		paneByElement.set(element, pane);
		nearObserver.observe(element);
		sizeObserver.observe(element);
		if (layoutWatchers++ === 0) sizeObserver.observe(document.body);
		requestGlassRedraw();
		return () => {
			nearObserver.unobserve(element);
			sizeObserver.unobserve(element);
			if (--layoutWatchers === 0) sizeObserver.unobserve(document.body);
			pane.context?.unconfigure();
			panes.delete(pane);
			paneByElement.delete(element);
			requestGlassRedraw();
		};
	};
}

export function glassPanes(): Iterable<GlassPaneState> {
	return panes;
}

/** The pane's effective options: global defaults + its overrides. */
export function paneOptions(pane: GlassPaneState): GlassOptions {
	const overrides = pane.getOptions();
	return overrides ? { ...liquidGlassConfig.defaults, ...overrides } : liquidGlassConfig.defaults;
}

/** Forget cached radii and force redraws (on resize; radii can be responsive). */
export function invalidateGlassPanes() {
	for (const pane of panes) {
		pane.radius = null;
		pane.dirty = true;
	}
}

/** Drop GPU state (device lost or recreated). */
export function releaseGlassPanes() {
	for (const pane of panes) {
		pane.context?.unconfigure();
		pane.device = null;
		pane.dirty = true;
	}
}

export function paneRadius(pane: GlassPaneState) {
	pane.radius ??= parseFloat(getComputedStyle(pane.element).borderTopLeftRadius) || 0;
	return pane.radius;
}

export function paneVariant(pane: GlassPaneState): GlassVariant {
	return pane.element.dataset.glass === "light" ? "light" : "dark";
}
