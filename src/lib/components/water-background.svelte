<script lang="ts">
	import { MediaQuery } from "svelte/reactivity";
	import waterTile from "#lib/assets/water-caustic.webp";
	import { animatedWater, useWebGPU } from "#lib/dev-settings.svelte.js";
	import { createWaterCaustic, type WaterCausticParams } from "#lib/shaders/water-caustic.js";

	/** Opacity of the brand-sky tint over the water (Figma: 0.85 on most frames, 0.5 on MY QR CODE). */
	let { overlay = 0.85 }: { overlay?: number } = $props();

	// Shader params from the Figma fill. `playhead` (0–100) is the phase; one cycle loops seamlessly.
	const params: WaterCausticParams = {
		center: { x: 50, y: 50 },
		scale: 1,
		playhead: 0,
		intensity: 0.5,
		waterColor: { r: 0, g: 0.388, b: 0.706, a: 1 },
		highlightColor: { r: 0.804, g: 0.961, b: 1, a: 1 },
	};
	const LOOP_MS = 75_000;

	const reducedMotion = new MediaQuery("prefers-reduced-motion: reduce");

	let canvas = $state<HTMLCanvasElement>();
	let ready = $state(false);

	$effect(() => {
		const target = canvas;
		const animate = animatedWater.current && !reducedMotion.current;
		if (!target || !navigator.gpu) return;

		let cancelled = false;
		let raf = 0;
		let device: GPUDevice | undefined;
		let context: GPUCanvasContext | null = null;
		let observer: ResizeObserver | undefined;

		(async () => {
			try {
				const adapter = await navigator.gpu.requestAdapter();
				device = await adapter?.requestDevice();
				context = target.getContext("webgpu");
				if (cancelled || !device || !context) return;

				const format = navigator.gpu.getPreferredCanvasFormat();
				context.configure({ device, format, alphaMode: "premultiplied" });
				const ctx = context;
				const render = createWaterCaustic(device, format);

				const draw = (time: number) => {
					const playhead = animate ? ((time % LOOP_MS) / LOOP_MS) * 100 : 0;
					render(ctx.getCurrentTexture(), { ...params, playhead });
					ready = true;
				};

				observer = new ResizeObserver(([entry]) => {
					const box = entry.devicePixelContentBoxSize?.[0];
					const dpr = window.devicePixelRatio || 1;
					target.width = Math.max(1, box?.inlineSize ?? Math.round(entry.contentRect.width * dpr));
					target.height = Math.max(1, box?.blockSize ?? Math.round(entry.contentRect.height * dpr));
					if (!animate) draw(0);
				});
				observer.observe(target);

				if (animate) {
					const loop = (time: number) => {
						draw(time);
						raf = requestAnimationFrame(loop);
					};
					raf = requestAnimationFrame(loop);
				}
			} catch (error) {
				// Keep the static fallback.
				console.warn("Water background: WebGPU unavailable", error);
			}
		})();

		return () => {
			cancelled = true;
			cancelAnimationFrame(raf);
			observer?.disconnect();
			context?.unconfigure();
			device?.destroy();
			ready = false;
		};
	});
</script>

<!-- Layers share one grid cell: static tile, WebGPU canvas (fades in once drawn), sky tint. -->
<div
	aria-hidden="true"
	class="pointer-events-none fixed inset-0 -z-10 grid grid-cols-1 grid-rows-1 [container-type:size]"
>
	<!-- The shader tiles a square the size of the shorter side, so the CPU-rendered tile repeats the same way. -->
	<div
		class="bg-repeat [background-size:100cqmin] [grid-area:1/1]"
		style:background-image="url({waterTile})"
	></div>
	{#if useWebGPU.current}
		<canvas
			bind:this={canvas}
			class={[
				"size-full transition-opacity duration-500 [grid-area:1/1]",
				ready ? "opacity-100" : "opacity-0",
			]}
		></canvas>
	{/if}
	<div class="bg-brand-sky [grid-area:1/1]" style:opacity={overlay}></div>
</div>
