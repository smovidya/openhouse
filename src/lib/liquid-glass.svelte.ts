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
	blur: 0,
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
	/** Inputs of the last draw; redraw only when they change. */
	key: string;
};

const panes = new Set<GlassPaneState>();

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
			key: "",
		};
		panes.add(pane);
		return () => {
			pane.context?.unconfigure();
			panes.delete(pane);
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
		pane.key = "";
	}
}

/** Drop GPU state (device lost or recreated). */
export function releaseGlassPanes() {
	for (const pane of panes) {
		pane.context?.unconfigure();
		pane.device = null;
		pane.key = "";
	}
}

export function paneRadius(pane: GlassPaneState) {
	pane.radius ??= parseFloat(getComputedStyle(pane.element).borderTopLeftRadius) || 0;
	return pane.radius;
}

export function paneVariant(pane: GlassPaneState): GlassVariant {
	return pane.element.dataset.glass === "light" ? "light" : "dark";
}
