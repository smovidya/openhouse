<script lang="ts">
	import { MediaQuery } from "svelte/reactivity";
	import waterTile from "#lib/assets/water-caustic.webp";
	import { animatedWater, glassMode, useWebGPU } from "#lib/dev-settings.svelte.js";
	import {
		commitFrame,
		createFrameHistory,
		isIdle,
		planFrame,
		type FrameInputs,
		type GlassMode,
	} from "./frame-plan.js";
	import {
		glassRenderer,
		invalidateGlassPanes,
		liquidGlassConfig,
		markPanesDrawn,
		releaseGlassPanes,
		requestGlassRedraw,
		setGlassRedrawHandler,
		snapshotPanes,
	} from "./panes.svelte.js";
	import { createRenderer } from "./renderer.js";

	type Props = {
		/** Opacity of the tint over the water (Figma: 0.85 on most frames, 0.5 on landing, 0.7 on staff). */
		overlay?: number;
		/** Tint colour: brand-sky for attendee pages, brand-navy for staff pages. */
		tint?: "sky" | "navy";
	};

	let { overlay = 0.85, tint = "sky" }: Props = $props();

	// --brand-sky / --brand-navy as 0–1 RGB, for the shader-side tint.
	const TINTS = {
		sky: [133 / 255, 184 / 255, 215 / 255],
		navy: [33 / 255, 58 / 255, 98 / 255],
	} as const;

	const reducedMotion = new MediaQuery("prefers-reduced-motion: reduce");

	/** Water in the page canvas; otherwise the static image shows. */
	const background = $derived(useWebGPU.current);
	/** Full glass samples the WebGPU water, so without it the closest mode is the rim alone. */
	const glass: GlassMode = $derived(
		!background && glassMode.current === "full" ? "rim" : glassMode.current
	);
	const animate = $derived(background && animatedWater.current && !reducedMotion.current);

	let canvas = $state<HTMLCanvasElement>();
	/** The first frame has been rendered (fades the page canvas in). */
	let started = $state(false);

	// Inputs read inside the (untracked) frame callback: ask for a frame when they change.
	$effect(() => {
		[tint, overlay, liquidGlassConfig.blur, ...Object.values(liquidGlassConfig.defaults)];
		requestGlassRedraw();
	});

	$effect(() => {
		const page = background ? canvas : null;
		const bg = background;
		const mode = glass;
		const anim = animate;
		if (!navigator.gpu || (bg && !page) || (!bg && mode === "css")) return;

		let cancelled = false;
		let scheduled = 0;
		let device: GPUDevice | undefined;
		let context: GPUCanvasContext | null = null;
		let renderer: ReturnType<typeof createRenderer> | undefined;
		let observer: ResizeObserver | undefined;
		let schedule = () => {};
		const onResize = () => {
			invalidateGlassPanes();
			schedule();
		};

		(async () => {
			try {
				const adapter = await navigator.gpu.requestAdapter();
				device = await adapter?.requestDevice();
				context = page?.getContext("webgpu") ?? null;
				if (cancelled || !device || (page && !context)) return;

				const gpu = device;
				const format = navigator.gpu.getPreferredCanvasFormat();
				context?.configure({ device: gpu, format, alphaMode: "premultiplied" });
				const frameRenderer = createRenderer(gpu, context, format);
				renderer = frameRenderer;
				const history = createFrameHistory();

				// On-demand rendering: frames run only when something asked for one (scroll, resize,
				// layout shift, pane added/removed, settings). Animated water keeps the loop alive.
				schedule = () => {
					if (!scheduled && !cancelled) scheduled = requestAnimationFrame(frame);
				};

				const frame = (time: number) => {
					scheduled = 0;
					if (anim) schedule();

					// 1. Prepare: the only DOM reads, and every canvas sized and configured.
					const dpr = page ? page.width / Math.max(1, page.clientWidth) : devicePixelRatio || 1;
					const inputs: FrameInputs = {
						time,
						width: page?.width ?? Math.round(innerWidth * dpr),
						height: page?.height ?? Math.round(innerHeight * dpr),
						dpr,
						background: bg,
						animate: anim,
						glass: mode,
						blurSigma: liquidGlassConfig.blur,
						tint: [...TINTS[tint], overlay],
						panes: mode === "css" ? [] : snapshotPanes(gpu, format, dpr),
					};
					// 2. Plan: which passes this frame needs.
					const plan = planFrame(inputs, history);
					if (!isIdle(plan)) {
						// 3. Execute: one command encoder, one submit.
						frameRenderer.execute(plan);
						// 4. Commit: what is on screen now.
						commitFrame(history, plan);
						markPanesDrawn(plan);
					}

					if (!started) {
						started = true;
						// Panes mount their canvases now and ask for the next frame.
						glassRenderer.mode = mode;
					}
				};

				if (page) {
					observer = new ResizeObserver(([entry]) => {
						const box = entry.devicePixelContentBoxSize?.[0];
						const ratio = window.devicePixelRatio || 1;
						// Emulated DPR (DevTools device mode, Playwright) isn't applied to the device-pixel
						// box, so never go below contentRect × dpr.
						const cssW = Math.round(entry.contentRect.width * ratio);
						const cssH = Math.round(entry.contentRect.height * ratio);
						page.width = Math.max(1, cssW, box?.inlineSize ?? 0);
						page.height = Math.max(1, cssH, box?.blockSize ?? 0);
						onResize();
					});
					// device-pixel-content-box gives exact device px (otherwise Chromium reports CSS px
					// there); Safari doesn't support it, so fall back to contentRect × dpr.
					try {
						observer.observe(page, { box: "device-pixel-content-box" });
					} catch {
						observer.observe(page);
					}
				} else {
					addEventListener("resize", onResize);
				}

				// Full glass shows the fixed water behind a scrolling pane; nothing else moves on scroll.
				if (mode === "full") addEventListener("scroll", schedule, { passive: true });
				setGlassRedrawHandler(schedule);
				schedule();
			} catch (error) {
				// Keep the static background and the CSS glass.
				console.warn("Water background: WebGPU unavailable", error);
			}
		})();

		return () => {
			cancelled = true;
			cancelAnimationFrame(scheduled);
			removeEventListener("scroll", schedule);
			removeEventListener("resize", onResize);
			setGlassRedrawHandler(null);
			observer?.disconnect();
			glassRenderer.mode = "css";
			releaseGlassPanes();
			renderer?.destroy();
			context?.unconfigure();
			device?.destroy();
			started = false;
		};
	});
</script>

<!-- Layers share one grid cell: static tile, tint, then the WebGPU canvas (fades in once drawn).
     The canvas draws the tint itself, so it covers the DOM tint and fades in over a tinted tile. -->
<div
	aria-hidden="true"
	class="pointer-events-none fixed inset-0 -z-10 grid grid-cols-1 grid-rows-1 [container-type:size]"
>
	<!-- The shader tiles a square the size of the shorter side, so the CPU-rendered tile repeats the same way. -->
	<div
		class="bg-repeat [background-size:100cqmin] [grid-area:1/1]"
		style:background-image="url({waterTile})"
	></div>
	<div
		class={["[grid-area:1/1]", tint === "navy" ? "bg-brand-navy" : "bg-brand-sky"]}
		style:opacity={overlay}
	></div>
	{#if background}
		<canvas
			bind:this={canvas}
			class={[
				// `relative`: the tint's opacity makes it a stacking context, which paints after in-flow
				// siblings; positioning the canvas keeps it above the tint (DOM order among positioned).
				"relative size-full transition-opacity duration-500 [grid-area:1/1]",
				started ? "opacity-100" : "opacity-0",
			]}
		></canvas>
	{/if}
</div>
