<script lang="ts">
	// Counts requestAnimationFrame callbacks, updated twice a second. Also shows the worst frame time in that window.
	let fps = $state(0);
	let worst = $state(0);

	$effect(() => {
		let frame = 0;
		let frames = 0;
		let windowStart = performance.now();
		let last = windowStart;
		let slowest = 0;

		const tick = (now: number) => {
			frames++;
			slowest = Math.max(slowest, now - last);
			last = now;
			if (now - windowStart >= 500) {
				fps = Math.round((frames * 1000) / (now - windowStart));
				worst = Math.round(slowest);
				frames = 0;
				slowest = 0;
				windowStart = now;
			}
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});
</script>

<div class="fps" aria-hidden="true">
	<strong class:low={fps < 30} class:mid={fps >= 30 && fps < 55}>{fps}</strong> fps
	<span>· {worst}ms max</span>
</div>

<style>
	.fps { position: fixed; top: max(8px, env(safe-area-inset-top)); left: 8px; z-index: 10000; pointer-events: none; padding: 4px 8px; border-radius: 6px; background: #18181bcc; color: #fafafa; font: 12px/1.4 ui-monospace, monospace; font-variant-numeric: tabular-nums; }
	strong { color: #a3e635; }
	strong.mid { color: #facc15; }
	strong.low { color: #f87171; }
	span { color: #a1a1aa; }
</style>
