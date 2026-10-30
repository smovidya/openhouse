<script lang="ts" module>
	const tabClass =
		"flex cursor-pointer items-center justify-center gap-1 rounded-full px-6 py-2 font-heading text-sm text-brand-brown";
	const activeTabClass = "border-2 border-brand-brown bg-brand-yellow";

	type InputMode = "scan" | "code";
</script>

<script lang="ts">
	import type { Snippet } from "svelte";
	import keyboardIcon from "#lib/assets/icons/keyboard-onscreen.svg";
	import scannerIcon from "#lib/assets/icons/qr-code-scanner.svg";
	import QrScanner from "#lib/components/qr-scanner.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { errorDialog } from "#lib/error-dialog.svelte.js";

	/** Scan a QR code, or type the code under it: both call `onScan`. */
	type Props = {
		/** Called with the scanned or typed code. If it returns a promise, the camera freezes until it settles. */
		onScan: (code: string) => unknown;
		/** Freezes the camera, e.g. while a sheet is open. It's also frozen while showError's dialog is. */
		paused?: boolean;
		/** The typed code; clear it once handled. */
		code?: string;
		codeLabel?: string;
		/** The code form's submit button, e.g. ลงทะเบียน. */
		submitLabel: string;
		/** Above the scan/code tabs, closer than the rest of the page (Figma: 12px), e.g. a mode switch. */
		header?: Snippet;
	};

	let {
		onScan,
		paused = false,
		code = $bindable(""),
		codeLabel = "กรอกรหัสของผู้ร่วมงาน",
		submitLabel,
		header,
	}: Props = $props();

	let mode = $state<InputMode>("scan");

</script>

<div class="flex w-full flex-col items-center gap-3">
	{@render header?.()}
	<!-- Segmented control (Figma). -->
	<div class="flex items-center overflow-clip rounded-full bg-brand-mist" role="group" aria-label="วิธีสแกน">
	<button
		type="button"
		aria-pressed={mode === "scan"}
		class={[tabClass, "w-[132px]", mode === "scan" && activeTabClass]}
		onclick={() => (mode = "scan")}
	>
		<img src={scannerIcon} alt="" />
		สแกน
	</button>
	<button
		type="button"
		aria-pressed={mode === "code"}
		class={[tabClass, mode === "code" && activeTabClass]}
		onclick={() => (mode = "code")}
	>
		<img src={keyboardIcon} alt="" />
		กรอกรหัส
	</button>
</div>
</div>

{#if mode === "scan"}
	<QrScanner {onScan} paused={paused || errorDialog.current !== null} />
{:else}
	<!-- Figma: the field, then a small button centered under it. -->
	<form
		class="flex w-full flex-col items-center gap-4"
		onsubmit={(event) => {
			event.preventDefault();
			if (code.trim()) void onScan(code.trim());
		}}
	>
		<div class="flex w-full flex-col gap-1">
			<label for="scan-code" class="text-center text-base text-brand-yellow">{codeLabel}</label>
			<Input
				id="scan-code"
				bind:value={code}
				autocomplete="off"
				autocapitalize="off"
				spellcheck={false}
				enterkeyhint="go"
				class="border-brand-sky focus-visible:border-brand-yellow focus-visible:ring-brand-yellow/60"
			/>
		</div>
		<Button type="submit" variant="cta" size="cta-sm" disabled={!code.trim()}>{submitLabel}</Button>
	</form>
{/if}
