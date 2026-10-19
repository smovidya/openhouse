<script lang="ts" module>
	import { attendeeStatusOptions } from "#lib/registration/options.ts";

	const statusLabels = new Map(attendeeStatusOptions.map((option) => [option.value, option.label]));

	/** A thrown remote-function error's HTTP status, if any. */
	const statusOf = (error: unknown) =>
		typeof error === "object" && error !== null && "status" in error ? error.status : null;
</script>

<script lang="ts">
	import closeIcon from "#lib/assets/icons/close.svg";
	import keyboardIcon from "#lib/assets/icons/keyboard-onscreen.svg";
	import scannerIcon from "#lib/assets/icons/qr-code-scanner.svg";
	import QrScanner from "#lib/components/qr-scanner.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import * as Sheet from "#lib/components/ui/sheet/index.js";
	import { getAttendeeProfileByQrCodeId } from "#lib/features/attendees/attendees.remote.ts";
	import { checkInAttendee } from "#lib/features/checkpoints/checkpoints.remote.ts";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	// Scan the attendee's QR code, or type the code under it.
	let mode = $state<"scan" | "code">("scan");

	type Attendee = Awaited<ReturnType<typeof getAttendeeProfileByQrCodeId>>;
	/** The attendee being confirmed in the sheet. */
	let attendee = $state<Attendee | null>(null);
	let sheetOpen = $state(false);
	let checkingIn = $state(false);
	/** Result of the last scan or check-in. */
	let message = $state<{ text: string; ok: boolean } | null>(null);
	let code = $state("");
	/** Resolves when the sheet closes: the scanner waits for it before reading the next code. */
	let sheetClosed: (() => void) | null = null;

	async function lookUp(qrCodeId: string) {
		message = null;
		try {
			attendee = await getAttendeeProfileByQrCodeId(qrCodeId);
		} catch (error) {
			message = {
				text: statusOf(error) === 404 ? "ไม่พบผู้เข้าร่วมงานจากรหัสนี้" : "ค้นหาไม่สำเร็จ กรุณาลองอีกครั้ง",
				ok: false,
			};
			return;
		}
		sheetOpen = true;
		return new Promise<void>((resolve) => (sheetClosed = resolve));
	}

	function closeSheet() {
		sheetOpen = false;
		sheetClosed?.();
		sheetClosed = null;
	}

	async function confirm() {
		if (!attendee || checkingIn) return;
		if (!data.entry) {
			message = { text: "ไม่พบจุดลงทะเบียน", ok: false };
			closeSheet();
			return;
		}
		checkingIn = true;
		const name = `${attendee.firstname} ${attendee.lastname}`;
		try {
			const result = await checkInAttendee({ qrCodeId: attendee.qrCodeId, checkpointId: data.entry.id });
			message = result.alreadyCheckedIn
				? { text: `${name} เช็คอินไปแล้วก่อนหน้านี้`, ok: true }
				: { text: `เช็คอิน ${name} แล้ว`, ok: true };
			code = "";
		} catch (error) {
			message = {
				text: statusOf(error) === 403 ? "ไม่มีสิทธิ์เช็คอินจุดลงทะเบียน" : "เช็คอินไม่สำเร็จ กรุณาลองอีกครั้ง",
				ok: false,
			};
		} finally {
			checkingIn = false;
			closeSheet();
		}
	}

	const tabClass =
		"flex cursor-pointer items-center justify-center gap-1 rounded-full px-6 py-2 font-heading text-sm text-brand-brown";
	const activeTabClass = "border-2 border-brand-brown bg-brand-yellow";
</script>

<svelte:head>
	<title>เช็คอินจุดลงทะเบียน | Science Chula Openhouse</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-[402px] flex-1 flex-col items-center justify-between gap-6 px-3 pt-6 pb-6">
	<div class="flex w-full flex-col items-center gap-6">
		<h1 class="text-center text-[32px] font-medium text-brand-yellow">เช็คอินจุดลงทะเบียน</h1>

		<!-- Segmented control (Figma). -->
		<div class="flex items-center overflow-clip rounded-full bg-brand-mist" role="group" aria-label="วิธีเช็คอิน">
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

		{#if mode === "scan"}
			<QrScanner onScan={lookUp} />
		{:else}
			<form
				class="flex w-full flex-col gap-1"
				onsubmit={(event) => {
					event.preventDefault();
					// Codes are upper case (see selfRegisterAttendee); staff may type them in lower case.
					if (code.trim()) void lookUp(code.trim().toUpperCase());
				}}
			>
				<label for="attendee-code" class="text-center text-base text-brand-yellow">กรอกรหัสของผู้ร่วมงาน</label>
				<Input
					id="attendee-code"
					bind:value={code}
					autocomplete="off"
					autocapitalize="characters"
					spellcheck={false}
					enterkeyhint="go"
					class="uppercase focus-visible:border-brand-yellow focus-visible:ring-brand-yellow/60"
				/>
			</form>
		{/if}

		{#if message}
			<p role={message.ok ? "status" : "alert"} class={["text-center text-sm", message.ok ? "text-brand-mist" : "text-brand-yellow"]}>
				{message.text}
			</p>
		{/if}
	</div>

	<Button variant="cta" size="cta-lg" href="/staff" class="w-full">ย้อนกลับ</Button>
</main>

<Sheet.Root
	open={sheetOpen}
	onOpenChange={(open) => {
		if (!open) closeSheet();
	}}
>
	<Sheet.Content
		side="bottom"
		showCloseButton={false}
		overlayClass="bg-black/40 supports-backdrop-filter:backdrop-blur-none"
		class="mx-auto max-w-[402px] gap-0 rounded-t-3xl border-0 bg-brand-mist px-2 pt-2 pb-6 data-[side=bottom]:h-[500px]"
	>
		<Sheet.Close
			class="relative ml-auto size-[30px] shrink-0 rounded-full bg-black/8 backdrop-blur-[4.583px]"
			aria-label="ปิด"
		>
			<img src={closeIcon} alt="" class="absolute top-[5px] left-[5px]" />
		</Sheet.Close>
		{#if attendee}
			<div class="flex flex-1 flex-col items-center justify-between">
				<div class="flex w-full flex-col gap-6 px-4">
					<Sheet.Title class="text-center font-heading text-[28px] font-medium text-black">
						เช็คอินผู้เข้าร่วมงาน
					</Sheet.Title>
					<dl class="flex flex-col gap-1 text-xl">
						{#each [
							["ชื่อ", `${attendee.firstname} ${attendee.lastname}`],
							["อายุ", `${attendee.age} ปี`],
							["สถานะ", statusLabels.get(attendee.type) ?? attendee.type],
						] as [label, value] (label)}
							<div class="flex gap-4">
								<dt class="w-[103px] shrink-0 text-brand-navy">{label}</dt>
								<dd class="min-w-0 flex-1 break-words text-black">{value}</dd>
							</div>
						{/each}
					</dl>
				</div>
				<div class="flex w-full flex-col gap-2">
					<Button variant="cta-light" size="cta-lg" class="w-full" onclick={closeSheet}>ยกเลิก</Button>
					<Button variant="cta" size="cta-lg" class="w-full" disabled={checkingIn} onclick={confirm}>
						{checkingIn ? "กำลังเช็คอิน…" : "ตกลง"}
					</Button>
				</div>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
