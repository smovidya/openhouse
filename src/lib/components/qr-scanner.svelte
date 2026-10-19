<script lang="ts" module>
	type Detector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };
	type NativeDetector = {
		new (options: { formats: string[] }): Detector;
		getSupportedFormats(): Promise<string[]>;
	};

	/**
	 * The browser's own BarcodeDetector where it reads QR codes (Chrome on Android), otherwise the
	 * zxing WebAssembly ponyfill (iOS Safari, desktop Firefox). The .wasm is served from our own
	 * build, not the package's default CDN.
	 */
	async function createDetector(): Promise<Detector> {
		const native = (globalThis as { BarcodeDetector?: NativeDetector }).BarcodeDetector;
		if (native && (await native.getSupportedFormats()).includes("qr_code")) {
			return new native({ formats: ["qr_code"] });
		}
		const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
			import("barcode-detector/ponyfill"),
			import("zxing-wasm/reader/zxing_reader.wasm?url"),
		]);
		prepareZXingModule({
			overrides: {
				locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path),
			},
		});
		return new BarcodeDetector({ formats: ["qr_code"] });
	}

	/** How often to look for a code in the video (ms). */
	const SCAN_INTERVAL = 150;
	/** The same code is ignored this long after it was handled, while it's still in front of the camera. */
	const SAME_CODE_COOLDOWN = 3000;
</script>

<script lang="ts">
	import { onMount } from "svelte";
	import CameraTroubleshoot from "#lib/components/camera-troubleshoot.svelte";
	import { cn } from "#lib/utils.js";
	import cornerBottomLeft from "#lib/assets/icons/scanner-corner-bottom-left.svg";
	import cornerBottomRight from "#lib/assets/icons/scanner-corner-bottom-right.svg";
	import cornerTopLeft from "#lib/assets/icons/scanner-corner-top-left.svg";
	import cornerTopRight from "#lib/assets/icons/scanner-corner-top-right.svg";

	type Props = {
		/**
		 * Called with each QR code's contents. If it returns a promise, scanning pauses until it
		 * settles (e.g. while a confirmation sheet is open).
		 */
		onScan: (contents: string) => unknown;
		class?: string;
	};

	let { onScan, class: className }: Props = $props();

	let video = $state<HTMLVideoElement>();
	let status = $state<"starting" | "scanning" | "denied" | "unavailable">("starting");

	onMount(() => {
		let stopped = false;
		let timer = 0;
		let stream: MediaStream | undefined;
		let last = { value: "", at: 0 };

		async function tick(detector: Detector) {
			if (stopped || !video) return;
			if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
				const [code] = await detector.detect(video).catch(() => []);
				const value = code?.rawValue;
				const repeat = value === last.value && Date.now() - last.at < SAME_CODE_COOLDOWN;
				if (value && !repeat && !stopped) {
					try {
						await onScan(value);
					} finally {
						last = { value, at: Date.now() };
					}
				}
			}
			if (!stopped) timer = window.setTimeout(() => tick(detector), SCAN_INTERVAL);
		}

		(async () => {
			try {
				const detector = await createDetector();
				// The back camera only: staff point the phone at the attendee's screen.
				stream = await navigator.mediaDevices.getUserMedia({
					video: { facingMode: { ideal: "environment" } },
					audio: false,
				});
				if (stopped || !video) return;
				video.srcObject = stream;
				await video.play();
				status = "scanning";
				void tick(detector);
			} catch (error) {
				if (stopped) return;
				status = error instanceof DOMException && error.name === "NotAllowedError" ? "denied" : "unavailable";
			}
		})();

		return () => {
			stopped = true;
			clearTimeout(timer);
			for (const track of stream?.getTracks() ?? []) track.stop();
		};
	});
</script>

<div class={cn("flex flex-col items-center gap-3", className)}>
	<!-- Viewfinder (Figma): the camera in a 268px square, framed by four corner brackets. -->
	<div class="relative h-[298.8px] w-[300px] shrink-0">
		<div class="absolute top-[12.03px] left-[14.43px] size-[268.06px] overflow-hidden bg-black">
			<video bind:this={video} class="size-full object-cover" muted playsinline aria-label="กล้องสแกน QR code"></video>
			{#if status !== "scanning"}
				<p class="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-brand-mist">
					{#if status === "starting"}
						กำลังเปิดกล้อง…
					{:else if status === "denied"}
						กรุณาอนุญาตให้เว็บไซต์ใช้กล้อง แล้วโหลดหน้าใหม่
					{:else}
						ไม่สามารถเปิดกล้องได้ ใช้ “กรอกรหัส” แทน
					{/if}
				</p>
			{/if}
		</div>
		<!-- Each corner is its own asset, rotated into place as in Figma. -->
		{#each [
			{ src: cornerTopLeft, position: "top-0 left-[3.61px]", rotate: "" },
			{ src: cornerTopRight, position: "top-0 left-[216.47px]", rotate: "rotate-90" },
			{ src: cornerBottomLeft, position: "top-[222.49px] left-0", rotate: "-rotate-90" },
			{ src: cornerBottomRight, position: "top-[222.49px] left-[223.69px]", rotate: "rotate-180" },
		] as corner (corner.src)}
			<div class={["pointer-events-none absolute size-[76.31px]", corner.position, corner.rotate]}>
				<img src={corner.src} alt="" class="absolute inset-[-0.75%_0_0_-0.82%] block size-auto max-w-none" />
			</div>
		{/each}
	</div>
	<!-- Help for a black or blocked camera, wherever the scanner is used. -->
	<CameraTroubleshoot />
</div>
