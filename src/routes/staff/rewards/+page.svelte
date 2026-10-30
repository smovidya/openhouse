<script lang="ts" module>
	import type { ErrorMessage } from "#lib/error-dialog.svelte.js";

	// redeemReward's 409 messages.
	const rejections = {
		ALREADY_REDEEMED: { title: "แลกของรางวัลไปแล้ว", description: "ผู้เข้าร่วมงานแลกของรางวัลไปแล้ว แลกซ้ำไม่ได้" },
		ENTRY_REQUIRED: {
			title: "ยังไม่ได้ผ่านจุดลงทะเบียน",
			description: "ให้ผู้เข้าร่วมงานไปรับของที่ระลึกที่จุดลงทะเบียนก่อน แล้วกลับมาใหม่",
		},
		REWARD_NOT_ELIGIBLE: { title: "ยังไม่ผ่านเกณฑ์", description: "ผู้เข้าร่วมงานยังไม่ผ่านเกณฑ์ขั้นใด" },
		PROGRESS_CHANGED: {
			title: "ข้อมูลเปลี่ยนไปแล้ว",
			description: "ขั้นของผู้เข้าร่วมงานเปลี่ยนระหว่างตรวจสอบ กรุณาสแกนใหม่อีกครั้ง",
		},
		GIFT_TIER_MISMATCH: { title: "ของรางวัลไม่ตรงขั้น", description: "กรุณาสแกนใหม่แล้วเลือกของรางวัลอีกครั้ง" },
		REWARD_SELECTION_UNAVAILABLE: {
			title: "เลือกของรางวัลนี้ไม่ได้",
			description: "ของรางวัลนี้ถูกปิดใช้งาน กรุณาสแกนใหม่อีกครั้ง",
		},
	} as const satisfies Record<string, ErrorMessage>;

	type Rejection = keyof typeof rejections;
	const isRejection = (code: string | null): code is Rejection => code !== null && Object.hasOwn(rejections, code);

	/** Checkpoints that count toward a tier; staff tell attendees which are left. */
	const collectable = new Set(["booth", "tcas", "central_activity", "stage"]);
</script>

<script lang="ts">
	import arrowRightIcon from "#lib/assets/icons/arrow-right.svg";
	import checkIcon from "#lib/assets/icons/check-circle-green.svg";
	import AttendeeDetails from "#lib/components/attendee-details.svelte";
	import RewardTierTable from "#lib/components/reward-tier-table.svelte";
	import ScanInput from "#lib/components/scan-input.svelte";
	import ScanSheet from "#lib/components/scan-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Drawer from "#lib/components/ui/drawer/index.js";
	import { Picker } from "#lib/components/ui/picker/index.js";
	import { showError } from "#lib/error-dialog.svelte.js";
	import { getAttendeeProfileByQrCodeId } from "#lib/features/attendees/attendees.remote.ts";
	import { souvenirTierForCheckpoint } from "#lib/features/dashboard/souvenirs.ts";
	import { previewReward, redeemReward } from "#lib/features/rewards/rewards.remote.ts";
	import { missingItems, nextTier, rewardHashtags, tierTitle } from "#lib/rewards.js";
	import { httpErrorMessage, httpStatus } from "#lib/utils.js";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	type Attendee = Awaited<ReturnType<typeof getAttendeeProfileByQrCodeId>>;
	type Preview = Awaited<ReturnType<typeof previewReward>>;
	/**
	 * Null before the first lookup. Closing keeps the contents, so the sheet still shows them as it
	 * slides away. It opens for anyone found, so staff can say what's missing even when they can't
	 * redeem yet.
	 */
	type Sheet = {
		attendee: Attendee;
		preview: Preview;
		giftId: string;
		state: "confirming" | "redeeming" | "closed";
	};
	let sheet = $state<Sheet | null>(null);
	const sheetOpen = $derived(sheet !== null && sheet.state !== "closed");
	/** Result of the last redemption. */
	let message = $state<string | null>(null);
	let code = $state("");

	function closeSheet() {
		if (sheet) sheet.state = "closed";
	}

	async function lookUp(qrCodeId: string) {
		message = null;
		try {
			const [attendee, preview] = await Promise.all([
				getAttendeeProfileByQrCodeId(qrCodeId),
				previewReward({ qrCodeId }),
			]);
			sheet = { attendee, preview, giftId: preview.gifts[0]?.id ?? "", state: "confirming" };
		} catch (caught) {
			// Awaited: the scanner stays frozen until it's dismissed.
			await showError(
				httpStatus(caught) === 404
					? { title: "ไม่พบผู้เข้าร่วมงาน", description: "ไม่พบผู้เข้าร่วมงานจากรหัสนี้ กรุณาตรวจสอบแล้วลองอีกครั้ง" }
					: httpStatus(caught) === 403
						? { title: "ไม่มีสิทธิ์", description: "บัญชีนี้ไม่มีสิทธิ์ตรวจสอบของรางวัล" }
						: { title: "ค้นหาไม่สำเร็จ", description: "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง" }
			);
		}
	}

	/** Why the open sheet can't redeem, or null when it can. */
	function blocker({ preview }: Sheet): string | null {
		const { progress } = preview;
		// Redemptions from before gifts were recorded have no gift name.
		if (progress.redemption) return `แลก${progress.redemption.giftName ?? "ของรางวัล"}ไปแล้ว`;
		if (!progress.entered) return "ยังไม่ได้ผ่านจุดลงทะเบียน";
		if (progress.highestEligibleTier === null) return "ยังไม่ผ่านเกณฑ์ขั้นใด";
		if (preview.gifts.length === 0) return "ยังไม่ได้ตั้งค่าของรางวัลของขั้นนี้ กรุณาติดต่อผู้ดูแลระบบ";
		return null;
	}

	/**
	 * Where a tier's handover is recorded. The admin dashboard tells tiers apart by the reward
	 * checkpoint's name, so use the tier's own point when there is one; else a point named for no
	 * tier (a single reward point), else any.
	 */
	function rewardPointFor(tier: 1 | 2 | 3) {
		const { rewardPoints } = data;
		return (
			rewardPoints.find((point) => souvenirTierForCheckpoint(point.name) === `tier${tier}`) ??
			rewardPoints.find((point) => souvenirTierForCheckpoint(point.name) === null) ??
			rewardPoints[0] ??
			null
		);
	}

	async function confirm() {
		const current = sheet;
		if (current?.state !== "confirming" || blocker(current)) return;
		const tier = current.preview.progress.highestEligibleTier;
		const gift = current.preview.gifts.find((candidate) => candidate.id === current.giftId);
		if (tier === null || !gift) return;
		const rewardPoint = rewardPointFor(tier);
		if (!rewardPoint) {
			current.state = "closed";
			void showError({
				title: "ระบบแลกของรางวัลยังไม่พร้อม",
				description: "ยังไม่ได้ตั้งค่าการแลกของรางวัลในระบบ หรือบัญชีนี้ไม่มีสิทธิ์ กรุณาติดต่อผู้ดูแลระบบ",
			});
			return;
		}
		current.state = "redeeming";
		const { attendee } = current;
		try {
			await redeemReward({
				qrCodeId: attendee.qrCodeId,
				checkpointId: rewardPoint.id,
				giftId: gift.id,
				expectedTier: tier,
			});
			message = `มอบ${gift.name}ให้ ${attendee.firstname} ${attendee.lastname} แล้ว`;
			code = "";
		} catch (caught) {
			const reason = httpErrorMessage(caught);
			void showError(
				isRejection(reason)
					? rejections[reason]
					: httpStatus(caught) === 403
						? { title: "ไม่มีสิทธิ์", description: "บัญชีนี้ไม่มีสิทธิ์แลกของรางวัล" }
						: { title: "แลกของรางวัลไม่สำเร็จ", description: "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง" }
			);
		} finally {
			current.state = "closed";
		}
	}
</script>

<svelte:head>
	<title>เช็คแลกของที่ระลึก | Science Chula Openhouse</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-[402px] flex-1 flex-col items-center justify-between gap-6 px-3 pt-6 pb-6">
	<div class="flex w-full flex-col items-center gap-6">
		<h1 class="text-center text-[32px] font-medium text-brand-yellow">เช็คแลกของที่ระลึก</h1>

		<ScanInput submitLabel="ตรวจสอบ" onScan={lookUp} paused={sheetOpen} bind:code />

		{#if message}
			<p role="status" class="flex items-center justify-center gap-1 text-center text-sm text-brand-mist">
				<img src={checkIcon} alt="" />
				{message}
			</p>
		{/if}

		<section class="flex w-full flex-col gap-3">
			<h2 class="text-2xl text-brand-sky">*เงื่อนไขแลกของรางวัลในแต่ละขั้น</h2>
			<RewardTierTable />
			<p class="text-sm text-brand-mist">
				ก่อนมอบของรางวัล ตรวจสอบว่าผู้เข้าร่วมงานลงสตอรี่ IG ติดแฮชแท็ก {rewardHashtags.join(" และ ")} ครบแล้ว
			</p>
		</section>

		<!-- Figma: a light pill under the table. -->
		<Button variant="cta-light" size="cta-sm" class="border" href="/staff/rewards/history">
			ดูประวัติการแลกของ
			<img src={arrowRightIcon} alt="" />
		</Button>
	</div>

	<Button variant="cta" size="cta-lg" href="/staff" class="w-full">ย้อนกลับ</Button>
</main>

<ScanSheet open={sheetOpen} onclose={closeSheet} class="h-[760px]">
	{#if sheet}
		{@const { progress, gifts } = sheet.preview}
		{@const reason = blocker(sheet)}
		{@const tier = progress.highestEligibleTier}
		{@const next = nextTier(tier)}
		{@const nextMissing = next && progress.requirements.find((requirement) => requirement.tier === next)?.missing}
		{@const remaining = progress.checkpoints.filter(
			(checkpoint) => collectable.has(checkpoint.type) && !checkpoint.completed
		)}
		<div class="flex flex-1 flex-col items-center justify-between gap-6">
			<div class="flex w-full flex-col gap-4 px-4">
				<Drawer.Title class="text-center font-heading text-[28px] font-medium text-black">รับของรางวัล</Drawer.Title>
				<AttendeeDetails attendee={sheet.attendee} />
				<RewardTierTable counts={progress.counts} highlight={reason ? null : tier} />

				{#if reason}
					<p role="alert" class="text-center font-heading text-xl text-brand-navy">{reason}</p>
				{:else if tier !== null}
					<p class="text-center font-heading text-xl text-brand-navy">“กำลังแลก {tierTitle(tier)}”</p>
					{#if gifts.length > 1}
						<Picker
							class="border-brand-sky"
							options={gifts.map((gift) => ({ value: gift.id, label: gift.name }))}
							bind:value={sheet.giftId}
						/>
					{:else}
						<p class="text-center text-base text-brand-navy">ของรางวัล: {gifts[0]?.name}</p>
					{/if}
				{/if}

				{#if !progress.redemption}
					<div class="flex flex-col gap-1 text-sm text-brand-navy">
						{#if next && nextMissing}
							<p>ขั้นถัดไป ({tierTitle(next)}) ขาด: {missingItems(nextMissing).join(", ")}</p>
						{/if}
						{#if remaining.length > 0}
							<details>
								<summary class="cursor-pointer">บูธที่ยังไม่ได้เก็บ ({remaining.length})</summary>
								<p>{remaining.map((checkpoint) => checkpoint.name ?? checkpoint.id).join(", ")}</p>
							</details>
						{/if}
						{#if !reason}
							<p class="text-status-red">เมื่อยืนยันแล้ว ระบบจะล็อก สะสมกิจกรรมเพื่อเลื่อนขั้นต่อไม่ได้อีก</p>
							<p>ตรวจสอบสตอรี่ IG ที่ติดแฮชแท็ก {rewardHashtags.join(" และ ")} ก่อนยืนยัน</p>
						{/if}
					</div>
				{/if}
			</div>
			<div class="flex w-full flex-col gap-2">
				<Button variant="cta-light" size="cta-lg" class="w-full border" onclick={closeSheet}>ยกเลิก</Button>
				<Button
					variant="cta"
					size="cta-lg"
					class="w-full"
					disabled={reason !== null || sheet.state !== "confirming"}
					onclick={confirm}
				>
					{sheet.state === "redeeming" ? "กำลังบันทึก…" : "ยืนยันการรับของ"}
				</Button>
			</div>
		</div>
	{/if}
</ScanSheet>
