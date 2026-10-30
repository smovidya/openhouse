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

	type CameraStatus = "starting" | "scanning" | "denied" | "unavailable";

	/** Shown over the video until the camera is scanning. */
	const statusMessages = {
		starting: "กำลังเปิดกล้อง…",
		denied: "กรุณาอนุญาตให้เว็บไซต์ใช้กล้อง แล้วโหลดหน้าใหม่",
		unavailable: "ไม่สามารถเปิดกล้องได้ ใช้ “กรอกรหัส” แทน",
	} satisfies Record<Exclude<CameraStatus, "scanning">, string>;

	/** How often to look for a code in the video (ms). */
	const SCAN_INTERVAL = 150;
	/** The same code is ignored this long after it was handled, while it's still in front of the camera. */
	const SAME_CODE_COOLDOWN = 3000;
</script>

<script lang="ts">
	import { onMount } from "svelte";
	import CameraTroubleshoot from "#lib/components/camera-troubleshoot.svelte";
	import { cn } from "#lib/utils.js";
	import cornerIcon from "#lib/assets/icons/scanner-corner-top-left.svg";

	type Props = {
		/** Called with each QR code's contents. If it returns a promise, the camera freezes until it settles. */
		onScan: (contents: string) => unknown;
		/** Freezes the camera and stops reading codes, e.g. while a sheet or error dialog is open. */
		paused?: boolean;
		class?: string;
	};

	let { onScan, paused = false, class: className }: Props = $props();

	let video = $state<HTMLVideoElement>();
	let status = $state<CameraStatus>("starting");

	onMount(() => {
		let unmounted = false;
		let timer = 0;
		let stream: MediaStream | undefined;
		let detector: Detector | undefined;
		let last = { value: "", at: 0 };
		/** Bumped by every start and stop: a scan loop or camera start from an older one ends itself. */
		let session = 0;
		const current = (id: number) => !unmounted && id === session;

		async function tick(id: number) {
			if (!current(id) || !video || !detector) return;
			if (paused) {
				// Restart the cooldown on resume, so the code still in front of the camera isn't read again.
				last.at = Date.now();
			} else if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
				const [code] = await detector.detect(video).catch(() => []);
				const value = code?.rawValue;
				const repeat = value === last.value && Date.now() - last.at < SAME_CODE_COOLDOWN;
				if (value && !repeat && current(id)) {
					let waiting = false;
					try {
						const pending = onScan(value);
						// Freeze on the scanned frame while the caller handles it.
						waiting = pending instanceof Promise;
						if (waiting) video.pause();
						await pending;
					} catch (error) {
						// A failing handler mustn't end the scan loop: keep scanning.
						console.error(error);
					} finally {
						last = { value, at: Date.now() };
						if (waiting && !paused && current(id)) await video.play().catch(() => {});
					}
				}
			}
			if (current(id)) timer = window.setTimeout(() => tick(id), SCAN_INTERVAL);
		}

		async function start() {
			const id = ++session;
			status = "starting";
			try {
				detector ??= await createDetector();
				// The back camera only: staff point the phone at the attendee's screen.
				const media = await navigator.mediaDevices.getUserMedia({
					video: { facingMode: { ideal: "environment" } },
					audio: false,
				});
				if (!current(id) || !video) {
					for (const track of media.getTracks()) track.stop();
					return;
				}
				stream = media;
				video.srcObject = stream;
				await video.play();
				status = "scanning";
				void tick(id);
			} catch (error) {
				if (!current(id)) return;
				status = error instanceof DOMException && error.name === "NotAllowedError" ? "denied" : "unavailable";
			}
		}

		/** Releases the camera, so the phone's camera light goes off. */
		function stop() {
			session++;
			clearTimeout(timer);
			for (const track of stream?.getTracks() ?? []) track.stop();
			stream = undefined;
			if (video) video.srcObject = null;
		}

		// In the background (another app or tab, or the screen off) the camera is released, and
		// reopened on return.
		function onVisibilityChange() {
			if (document.hidden) stop();
			else void start();
		}
		document.addEventListener("visibilitychange", onVisibilityChange);
		if (!document.hidden) void start();

		return () => {
			unmounted = true;
			document.removeEventListener("visibilitychange", onVisibilityChange);
			stop();
		};
	});

	$effect(() => {
		if (!video || status !== "scanning") return;
		if (paused) video.pause();
		else void video.play().catch(() => {});
	});
</script>

<div class={cn("flex flex-col items-center gap-3", className)}>
	<!-- Viewfinder (Figma): the camera in a 268px square, centered between four corner brackets. -->
	<div class="relative size-[300px] shrink-0">
		<div class="absolute inset-4 overflow-hidden bg-black">
			<video bind:this={video} class="size-full object-cover" muted playsinline aria-label="กล้องสแกน QR code"></video>
			{#if status !== "scanning"}
				<p class="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-brand-mist">
					{statusMessages[status]}
				</p>
			{/if}
		</div>
		<!-- One bracket, rotated into each corner. -->
		{#each ["top-0 left-0", "top-0 right-0 rotate-90", "bottom-0 right-0 rotate-180", "bottom-0 left-0 -rotate-90"] as corner (corner)}
			<img src={cornerIcon} alt="" class={["pointer-events-none absolute size-[77px]", corner]} />
		{/each}
	</div>
	<!-- Help for a black or blocked camera, wherever the scanner is used. -->
	<CameraTroubleshoot />
</div>
