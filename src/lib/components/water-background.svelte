<script lang="ts">
	import { MediaQuery } from "svelte/reactivity";
	import waterTile from "#lib/assets/water-caustic.webp";
	import { animatedWater, liquidGlass, useWebGPU } from "#lib/dev-settings.svelte.js";
	import {
		glassPanes,
		invalidateGlassPanes,
		paneRadius,
		paneVariant,
		releaseGlassPanes,
		requestGlassRedraw,
		setGlassRedrawHandler,
		liquidGlassConfig,
		paneOptions,
	} from "#lib/liquid-glass.svelte.js";
	import { createBlur } from "#lib/shaders/blur.js";
	import { createLiquidGlass } from "#lib/shaders/liquid-glass.js";
	import { createWaterCaustic, type WaterCausticParams } from "#lib/shaders/water-caustic.js";

	type Props = {
		/** Opacity of the tint over the water (Figma: 0.85 on most frames, 0.5 on landing, 0.7 on staff). */
		overlay?: number;
		/** Tint colour: brand-sky for attendee pages, brand-navy for staff pages. */
		tint?: "sky" | "navy";
	};

	let { overlay = 0.85, tint = "sky" }: Props = $props();

	// Shader params from the Figma fill. `playhead` (0–100) is the phase; one cycle loops seamlessly.
	const params: WaterCausticParams = {
		center: { x: 50, y: 50 },
		scale: 1,
		playhead: 0,
		intensity: 0.5,
		waterColor: { r: 0, g: 0.388, b: 0.706, a: 1 },
		highlightColor: { r: 0.804, g: 0.961, b: 1, a: 1 },
	};
	const LOOP_MS = 100_000;
	/** The shared glass backdrop is blurred at 1/4 resolution per axis (1/16 the pixels). */
	const BLUR_DOWNSCALE = 4;

	// --brand-sky / --brand-navy as 0–1 RGB, for the shader-side tint.
	const TINTS = {
		sky: [133 / 255, 184 / 255, 215 / 255],
		navy: [33 / 255, 58 / 255, 98 / 255],
	} as const;

	const reducedMotion = new MediaQuery("prefers-reduced-motion: reduce");

	let canvas = $state<HTMLCanvasElement>();
	let ready = $state(false);

	// Inputs read inside the (untracked) frame callback: ask for a frame when they change.
	$effect(() => {
		[tint, overlay, liquidGlassConfig.blur, ...Object.values(liquidGlassConfig.defaults)];
		requestGlassRedraw();
	});

	$effect(() => {
		const target = canvas;
		const animate = animatedWater.current && !reducedMotion.current;
		const refract = liquidGlass.current;
		if (!target || !navigator.gpu) return;

		let cancelled = false;
		let scheduled = 0;
		let device: GPUDevice | undefined;
		let context: GPUCanvasContext | null = null;
		let observer: ResizeObserver | undefined;
		let waterTexture: GPUTexture | undefined;
		let blurTextures: [GPUTexture, GPUTexture] | undefined;
		let schedule = () => {};

		(async () => {
			try {
				const adapter = await navigator.gpu.requestAdapter();
				device = await adapter?.requestDevice();
				context = target.getContext("webgpu");
				if (cancelled || !device || !context) return;

				const gpu = device;
				const ctx = context;
				const format = navigator.gpu.getPreferredCanvasFormat();
				ctx.configure({ device: gpu, format, alphaMode: "premultiplied" });

				// Water renders into an offscreen texture (+ a blurred copy for the glass). This fixed
				// canvas only shows the tinted water; every <Glass> pane draws itself into its own
				// canvas, which the compositor scrolls together with the card.
				const WATER_FORMAT: GPUTextureFormat = "rgba8unorm";
				const renderWater = createWaterCaustic(gpu, WATER_FORMAT);
				const blur = createBlur(gpu, WATER_FORMAT);
				const glass = createLiquidGlass(gpu, format);

				let waterDirty = true;
				let blurSigma = liquidGlassConfig.blur;
				// Bumped whenever what the glass sees changes (water, blur, tint).
				let sceneVersion = 0;
				let tintKey = "";
				let drawnBackground = -1;

				// On-demand rendering: frames run only when something asked for one (scroll, resize,
				// layout shift, pane added/removed, settings). Animated water keeps the loop alive.
				schedule = () => {
					if (!scheduled && !cancelled) scheduled = requestAnimationFrame(frame);
				};

				const frame = (time: number) => {
					scheduled = 0;
					if (animate) schedule();

					const { width, height } = target;
					const scale = width / Math.max(1, target.clientWidth);
					const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;

					if (!waterTexture || waterTexture.width !== width || waterTexture.height !== height) {
						waterTexture?.destroy();
						blurTextures?.forEach((t) => t.destroy());
						waterTexture = gpu.createTexture({ size: [width, height], format: WATER_FORMAT, usage });
						// The frost is soft, so blur at 1/BLUR_DOWNSCALE resolution (per axis).
						const small = [
							Math.max(1, Math.ceil(width / BLUR_DOWNSCALE)),
							Math.max(1, Math.ceil(height / BLUR_DOWNSCALE)),
						];
						blurTextures = [0, 1].map(() =>
							gpu.createTexture({ size: small, format: WATER_FORMAT, usage })
						) as [GPUTexture, GPUTexture];
						glass.bind(waterTexture, blurTextures[1]);
						waterDirty = true;
					}
					const [blurTmp, blurred] = blurTextures!;
					const blurChanged = blurSigma !== liquidGlassConfig.blur;
					if (animate || waterDirty) {
						const playhead = animate ? ((time % LOOP_MS) / LOOP_MS) * 100 : 0;
						renderWater(waterTexture, { ...params, playhead });
					}
					// Global frost: one blurred copy shared by every pane.
					if (blurChanged) blurSigma = liquidGlassConfig.blur;
					if (refract && (animate || waterDirty || blurChanged)) {
						blur(waterTexture, blurTmp, blurred, (blurSigma * scale) / BLUR_DOWNSCALE);
					}
					if (animate || waterDirty || blurChanged) sceneVersion++;
					waterDirty = false;

					// The canvases apply the page tint themselves (so glass fills sit above it, as in Figma).
					const tintRgba: [number, number, number, number] = [...TINTS[tint], overlay];
					const nextTintKey = tintRgba.join();
					if (nextTintKey !== tintKey) {
						tintKey = nextTintKey;
						sceneVersion++;
					}

					if (drawnBackground !== sceneVersion) {
						glass.background(ctx.getCurrentTexture(), scale, tintRgba);
						drawnBackground = sceneVersion;
					}

					if (refract) {
						const viewport = { width, height };
						const vw = innerWidth;
						const vh = innerHeight;
						for (const pane of glassPanes()) {
							// Far panes (beyond one viewport of margin) aren't even measured.
							if (!pane.near) continue;
							const box = pane.element.getBoundingClientRect();
							const w = Math.max(1, Math.round(box.width * scale));
							const h = Math.max(1, Math.round(box.height * scale));
							if (pane.canvas.width !== w || pane.canvas.height !== h) {
								pane.canvas.width = w;
								pane.canvas.height = h;
								pane.dirty = true;
							}
							pane.context ??= pane.canvas.getContext("webgpu");
							if (!pane.context) continue;
							if (pane.device !== gpu) {
								pane.context.configure({ device: gpu, format, alphaMode: "premultiplied" });
								pane.device = gpu;
								pane.dirty = true;
							}
							const x = box.left * scale;
							const y = box.top * scale;
							const options = paneOptions(pane);
							const optionsKey = Object.values(options).join();
							// On screen: redraw when anything changed, including position (the glass shows the
							// fixed water behind it). Off screen (the pre-render margin): only when dirty —
							// entered the margin, resized, context reset. Water/tint/option changes wait; the
							// pane moves when it scrolls into view, which redraws it with the current scene.
							const onScreen = box.bottom > 0 && box.top < vh && box.right > 0 && box.left < vw;
							const changed =
								x !== pane.x ||
								y !== pane.y ||
								pane.sceneVersion !== sceneVersion ||
								pane.optionsKey !== optionsKey;
							if (!pane.dirty && !(onScreen && changed)) {
								continue;
							}
							glass.glass(
								pane.context.getCurrentTexture(),
								viewport,
								{ x, y, width: w, height: h, radius: paneRadius(pane) * scale, variant: paneVariant(pane) },
								scale,
								tintRgba,
								options
							);
							pane.x = x;
							pane.y = y;
							pane.sceneVersion = sceneVersion;
							pane.optionsKey = optionsKey;
							pane.dirty = false;
						}
					}

					if (!ready) {
						ready = true;
						if (refract) document.documentElement.dataset.liquidGlass = "on";
					}
				};

				observer = new ResizeObserver(([entry]) => {
					const box = entry.devicePixelContentBoxSize?.[0];
					const dpr = window.devicePixelRatio || 1;
					// Emulated DPR (DevTools device mode, Playwright) isn't applied to the device-pixel
					// box, so never go below contentRect × dpr.
					const cssW = Math.round(entry.contentRect.width * dpr);
					const cssH = Math.round(entry.contentRect.height * dpr);
					target.width = Math.max(1, cssW, box?.inlineSize ?? 0);
					target.height = Math.max(1, cssH, box?.blockSize ?? 0);
					invalidateGlassPanes();
					schedule();
				});
				// device-pixel-content-box gives exact device px (otherwise Chromium reports CSS px
				// there); Safari doesn't support it, so fall back to contentRect × dpr.
				try {
					observer.observe(target, { box: "device-pixel-content-box" });
				} catch {
					observer.observe(target);
				}

				addEventListener("scroll", schedule, { passive: true });
				setGlassRedrawHandler(schedule);
				schedule();
			} catch (error) {
				// Keep the static fallback (and CSS blur on glass).
				console.warn("Water background: WebGPU unavailable", error);
			}
		})();

		return () => {
			cancelled = true;
			cancelAnimationFrame(scheduled);
			removeEventListener("scroll", schedule);
			setGlassRedrawHandler(null);
			observer?.disconnect();
			delete document.documentElement.dataset.liquidGlass;
			releaseGlassPanes();
			waterTexture?.destroy();
			blurTextures?.forEach((t) => t.destroy());
			context?.unconfigure();
			device?.destroy();
			ready = false;
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
	{#if useWebGPU.current}
		<canvas
			bind:this={canvas}
			class={[
				// `relative`: the tint's opacity makes it a stacking context, which paints after in-flow
				// siblings; positioning the canvas keeps it above the tint (DOM order among positioned).
				"relative size-full transition-opacity duration-500 [grid-area:1/1]",
				ready ? "opacity-100" : "opacity-0",
			]}
		></canvas>
	{/if}
</div>
