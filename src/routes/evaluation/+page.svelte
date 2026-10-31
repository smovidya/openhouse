<script lang="ts">
	import { fromAction } from "svelte/attachments";
	import { defaults, superForm } from "sveltekit-superforms";
	import { zod4 } from "sveltekit-superforms/adapters";
	import { EVENT_SCHEDULE } from "#lib/constants/time.ts";
	import { continueStudyOptions, evaluationPurposeOptions, evaluationResponseSchema } from "#lib/features/surveys/schemas.js";
	import { submitMyEvaluationResponse } from "#lib/features/surveys/surveys.remote.ts";
	import { majorOptions } from "#lib/registration/options.js";
	import SignBoard from "#lib/components/sign-board.svelte";
	import Glass from "#lib/render/glass.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Form from "#lib/components/ui/form/index.js";
	import { MultiPicker, Picker } from "#lib/components/ui/picker/index.js";
	import { Separator } from "#lib/components/ui/separator/index.js";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	type RatingField =
		| "boothActivitiesRating"
		| "venueCrowdRating"
		| "venueTravelRating"
		| "venueToiletRating"
		| "venueMedicalRating"
		| "venueCleanlinessRating"
		| "websiteAccessRating"
		| "websiteUsabilityRating"
		| "websiteAppearanceRating"
		| "activityInfoRating"
		| "activityWorkshopSignupRating"
		| "activityWorkshopAccessRating"
		| "activitySouvenirRating"
		| "workshopContentRating"
		| "overallRating"
		| "recommendRating"
		| "boothContentRating"
		| "boothCommunicationRating"
		| "boothMediaRating";

	let done = $state(false);
	let submitError = $state("");

	const opensAtLabel = new Intl.DateTimeFormat("th-TH", {
		dateStyle: "long",
		timeStyle: "short",
		timeZone: "Asia/Bangkok",
	}).format(new Date(EVENT_SCHEDULE.eventStartsAt));

	const form = superForm(defaults(zod4(evaluationResponseSchema)), {
		SPA: true,
		dataType: "json",
		resetForm: false,
		validators: zod4(evaluationResponseSchema),
		async onUpdate({ form, formElement }) {
			if (!form.valid) {
				scrollToFirstError(formElement);
				return;
			}
			submitError = "";
			const result = await submitMyEvaluationResponse(form.data);
			if (result.isErr()) {
				submitError = evaluationErrorMessage(result.error);
				if (result.error === "ALREADY_SUBMITTED") done = true;
				return;
			}
			done = true;
		},
	});
	const { form: formData, enhance, submitting } = form;
	const enhanceAttachment = fromAction(enhance);

	/**
	 * superforms v3 skips its built-in scroll in SPA mode, so on a failed submit we
	 * scroll to the first invalid question ourselves. Every Form.Label carries
	 * `data-fs-error` when its field has errors, in document order.
	 */
	function scrollToFirstError(root: HTMLElement) {
		const label = root.querySelector("[data-fs-error]");
		if (!label) return;
		label.scrollIntoView({ behavior: "smooth", block: "center" });
	}

	const favoriteLabel = $derived(
		majorOptions.find((option) => option.value === $formData.favoriteDepartment)?.label
	);

	function evaluationErrorMessage(code: string) {
		switch (code) {
			case "ATTENDEE_NOT_FOUND":
				return "กรุณาลงทะเบียนเข้าร่วมงานก่อน";
			case "ENTRY_REQUIRED":
				return "กรุณาเช็คอินที่จุดลงทะเบียนในวันงานก่อนทำแบบประเมิน";
			case "EVALUATION_NOT_OPEN":
				return "แบบประเมินยังไม่เปิดให้ตอบ ขออภัยในความไม่สะดวก";
			case "ALREADY_SUBMITTED":
				return "ส่งแบบประเมินเรียบร้อยแล้ว";
			case "SUBMIT_EVALUATION_FAILED":
			default:
				return "ไม่สามารถส่งแบบประเมินได้ กรุณาลองอีกครั้ง";
		}
	}
</script>

<svelte:head>
	<title>ประเมินผล | Science Chula Openhouse</title>
</svelte:head>

{#snippet ratingField(name: RatingField, label: string)}
	<Form.Field {form} {name} class="space-y-1">
		<Form.Control>
			{#snippet children({ props })}
				<Form.Label class="text-base leading-normal font-normal text-brand-navy">{label}</Form.Label>
				<div {...props} role="radiogroup" aria-label={label} class="grid grid-cols-4 gap-2">
					{#each [1, 2, 3, 4] as score (score)}
						{@const selected = $formData[name] === score}
						<button
							type="button"
							aria-pressed={selected}
							class="h-11 cursor-pointer rounded-lg border text-lg outline-none transition-colors focus-visible:ring-3 focus-visible:ring-brand-blue/50 {selected
								? 'border-brand-blue bg-brand-blue text-brand-mist'
								: 'border-transparent bg-brand-mist text-brand-navy hover:bg-brand-sky/30'}"
							onclick={() => ($formData[name] = score)}
						>
							{score}
						</button>
					{/each}
				</div>
				<div class="flex items-center justify-between text-xs leading-normal text-brand-navy/70">
					<span>1 · ไม่พอใจ</span>
					<span>4 · พอใจ</span>
				</div>
			{/snippet}
		</Form.Control>
		<Form.FieldErrors />
	</Form.Field>
{/snippet}

<main class="mx-auto flex w-full max-w-[402px] flex-1 flex-col gap-6 px-3 pt-6 pb-4">
	{#if !data.opened}
		<div class="flex justify-center">
			<SignBoard title="ประเมินผล" wide />
		</div>
		<Glass class="rounded-xl flex w-full flex-col items-center gap-2 p-4 text-center">
			<p class="text-base text-brand-yellow">แบบประเมินยังไม่เปิด</p>
			<p class="text-xs text-brand-mist">แบบประเมินจะเปิดให้ตอบเมื่อเริ่มงาน {opensAtLabel} น.</p>
			<Button variant="cta" size="cta-sm" href="/myid">ย้อนกลับ</Button>
		</Glass>
	{:else if !data.entered}
		<div class="flex justify-center">
			<SignBoard title="ประเมินผล" wide />
		</div>
		<Glass class="rounded-xl flex w-full flex-col items-center gap-2 p-4 text-center">
			<p class="text-base text-brand-yellow">เช็คอินก่อนทำแบบประเมิน</p>
			<p class="text-xs text-brand-mist">
				กรุณาเช็คอินที่จุดลงทะเบียนในวันงานก่อน จึงจะทำแบบประเมินและรับเกียรติบัตรได้
			</p>
			<Button variant="cta" size="cta-sm" href="/myid">กลับไปหน้า MY QR CODE</Button>
		</Glass>
	{:else if done || data.submitted}
		<div class="flex justify-center">
			<SignBoard title="ขอบคุณ" wide />
		</div>
		<Glass class="rounded-xl flex w-full flex-col gap-2 p-4 text-center">
			<p class="text-lg text-brand-navy">
				ส่งแบบประเมินเรียบร้อย <span class="font-bold text-status-green">✓</span>
			</p>
			<p class="text-xs text-brand-mist">
				เกียรติบัตรจะพร้อมให้ดาวน์โหลดภายหลัง ติดตามประกาศได้ที่ Instagram:
				<a
					href="https://www.instagram.com/scichulaopenhouse"
					target="_blank"
					rel="noreferrer"
					class="font-bold text-brand-sky underline"
				>
					@scichulaopenhouse
				</a>
			</p>
		</Glass>
		<Button variant="cta" size="cta-lg" href="/myid" class="w-full">กลับไปหน้า MY QR CODE</Button>
	{:else}
		<div class="flex justify-center">
			<SignBoard title="ประเมินผล" wide />
		</div>

		<form
			method="POST"
			{@attach enhanceAttachment}
			aria-busy={$submitting}
			class="flex flex-col gap-6"
		>
			<section class="flex flex-col gap-2">
				<h2 class="text-xl font-medium text-brand-navy">จุดประสงค์การเข้าร่วม</h2>
				<Form.Field {form} name="purpose" class="space-y-1">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label class="text-base leading-normal font-normal text-brand-navy">
								จุดประสงค์ในการเข้าร่วมงาน (เลือกได้มากกว่า 1 ข้อ)
							</Form.Label>
							<MultiPicker
								id={props.id}
								name={props.name}
								placeholder="เลือกจุดประสงค์"
								options={evaluationPurposeOptions}
								bind:value={$formData.purpose}
							/>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
			</section>

			<Separator class="bg-brand-blue" />

			<section class="flex flex-col gap-3">
				<h2 class="text-xl font-medium text-brand-navy">ภาควิชา</h2>
				<Form.Field {form} name="departments" class="space-y-1">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label class="text-base leading-normal font-normal text-brand-navy">
								ภาควิชาที่มีความสนใจ (เลือกได้มากกว่า 1 สาขา)
							</Form.Label>
							<MultiPicker
								id={props.id}
								name={props.name}
								placeholder="เลือกภาควิชา"
								options={majorOptions}
								bind:value={$formData.departments}
							/>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				<Form.Field {form} name="favoriteDepartment" class="space-y-1">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label class="text-base leading-normal font-normal text-brand-navy">
								บูธของภาควิชาที่ชื่นชอบที่สุด (เลือก 1 ข้อ)
							</Form.Label>
							<Picker
								id={props.id}
								name={props.name}
								placeholder="เลือกบูธที่ชื่นชอบ"
								options={majorOptions}
								bind:value={$formData.favoriteDepartment}
							/>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				{@render ratingField("boothActivitiesRating", "กิจกรรมในบูธต่าง ๆ น่าสนใจและเป็นประโยชน์")}
			</section>

			<Separator class="bg-brand-blue" />

			<section class="flex flex-col gap-3">
				<h2 class="text-xl font-medium text-brand-navy">สถานที่จัดงาน</h2>
				{@render ratingField("venueCrowdRating", "ความแออัดของสถานที่จัดงาน")}
				{@render ratingField("venueTravelRating", "ความสะดวกในการเดินทางมาเข้าร่วมงาน")}
				{@render ratingField("venueToiletRating", "ความเพียงพอของห้องสุขา")}
				{@render ratingField("venueMedicalRating", "ความเหมาะสมของจุดพยาบาล")}
				{@render ratingField("venueCleanlinessRating", "ความสะอาดภายในงานและจุดทิ้งขยะ")}
			</section>

			<Separator class="bg-brand-blue" />

			<section class="flex flex-col gap-3">
				<h2 class="text-xl font-medium text-brand-navy">การลงทะเบียน</h2>
				{@render ratingField("websiteAccessRating", "เว็บไซต์ง่ายต่อการเข้าถึง")}
				{@render ratingField("websiteUsabilityRating", "เว็บไซต์ใช้งานง่าย")}
				{@render ratingField("websiteAppearanceRating", "เว็บไซต์มีความสวยงาม")}
			</section>

			<Separator class="bg-brand-blue" />

			<section class="flex flex-col gap-3">
				<h2 class="text-xl font-medium text-brand-navy">กิจกรรม</h2>
				{@render ratingField("activityInfoRating", "ท่านได้รับข้อมูลเกี่ยวกับงานครบถ้วน ไม่สับสน")}
				{@render ratingField("activityWorkshopSignupRating", "ระยะเวลาลงทะเบียนเวิร์กช็อปเหมาะสม")}
				{@render ratingField("activityWorkshopAccessRating", "สามารถเข้าร่วมเวิร์กช็อปได้ตามต้องการ")}
				{@render ratingField("activitySouvenirRating", "ของที่ระลึกที่ได้มีความเหมาะสม")}
			</section>

			<Separator class="bg-brand-blue" />

			<section class="flex flex-col gap-3">
				<h2 class="text-xl font-medium text-brand-navy">เวิร์กช็อป</h2>
				{@render ratingField("workshopContentRating", "เนื้อหาสาระกิจกรรมตรงตามความคาดหวัง")}
			</section>

			<Separator class="bg-brand-blue" />

			<section class="flex flex-col gap-3">
				<h2 class="text-xl font-medium text-brand-navy">ภาพรวม</h2>
				{@render ratingField("overallRating", "ความพึงพอใจต่องานโดยรวม")}
				{@render ratingField("recommendRating", "หากมีโอกาสหน้าท่านจะแนะนำ Sci Chula Openhouse แก่ผู้อื่น")}

				<Form.Field {form} name="continueStudy" class="space-y-1">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label class="text-base leading-normal font-normal text-brand-navy">
								หลังจากเข้าร่วมงาน ท่านมีความคิดที่จะศึกษาต่อที่นี่หรือไม่
							</Form.Label>
							<Picker
								id={props.id}
								name={props.name}
								placeholder="เลือกคำตอบ"
								options={continueStudyOptions}
								bind:value={$formData.continueStudy}
							/>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
			</section>

			<Separator class="bg-brand-blue" />

			<section class="flex flex-col gap-3">
				<h2 class="text-xl font-medium text-brand-navy">ข้อเสนอแนะ/ติชม</h2>
				<Form.Field {form} name="comment" class="space-y-1">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label class="text-base leading-normal font-normal text-brand-navy">
								ข้อเสนอแนะอื่น ๆ (ถ้ามี)
							</Form.Label>
							<textarea
								{...props}
								bind:value={$formData.comment}
								rows="4"
								placeholder="ความคิดเห็น ข้อเสนอแนะ สำหรับการจัดงานครั้งนี้"
								class="w-full min-w-0 rounded-lg border border-transparent bg-brand-mist px-3 py-2 text-base text-brand-navy outline-none transition-[color,box-shadow] placeholder:text-brand-sky focus-visible:border-brand-navy focus-visible:ring-3 focus-visible:ring-brand-navy/50"
							></textarea>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
			</section>

			<Separator class="bg-brand-blue" />

			<section class="flex flex-col gap-3">
				<h2 class="text-xl font-medium text-brand-navy">
					บูธภาควิชา {favoriteLabel ? `(${favoriteLabel})` : ""}
				</h2>
				{#if !favoriteLabel}
					<p class="text-xs text-brand-sky">
						กรุณาเลือก “บูธของภาควิชาที่ชื่นชอบที่สุด” ข้างต้นก่อน เพื่อให้คำถามกลุ่มนี้เกี่ยวข้องกับบูธที่ท่านประเมิน
					</p>
				{/if}
				{@render ratingField("boothContentRating", "เนื้อหาตรงกับที่คาดหวังในภาควิชา")}
				{@render ratingField("boothCommunicationRating", "ความเหมาะสมในการสื่อสารของผู้ปฏิบัติงานประจำบูธ")}
				{@render ratingField("boothMediaRating", "ความน่าสนใจของสื่อที่ใช้ในการนำเสนอภาควิชา")}
			</section>

			{#if submitError}
				<p class="text-sm text-status-red" role="alert">{submitError}</p>
			{/if}

			<Button type="submit" variant="cta" size="cta-lg" class="w-full" disabled={$submitting}>
				{$submitting ? "กำลังส่งแบบประเมิน..." : "ส่งแบบประเมิน"}
			</Button>
		</form>
	{/if}
</main>
