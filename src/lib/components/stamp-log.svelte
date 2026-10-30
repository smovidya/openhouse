<script lang="ts">
	import arrowRightIcon from "#lib/assets/icons/arrow-right.svg";
	import { cn } from "#lib/utils.js";

	type Checkpoint = {
		id: string;
		name: string | null;
		type: string;
		department?: string | null;
		workshopId?: string | null;
		workshopName?: string | null;
		completed: boolean;
	};

	type Stamp = { id: string; label: string; ink: string; done: boolean };

	type Registered = { slug: string; title: string; type: "advance" | "walk-in" };

	let {
		checkpoints = [],
		registered = [],
	}: { checkpoints: Checkpoint[]; registered: Registered[] } = $props();

	let open = $state(false);

	// Ink colors follow the venue map's checkpoint colors (venue-map.svelte), so the stamps
	// read like the event's official legend.
	const INK: Record<string, string> = {
		booth: "#ffec9f",
		entry: "#8fc3f6",
		tcas: "#a8efa0",
		central_activity: "#97e5e9",
		stage: "#f382cb",
		workshop: "#ffad70",
	};

	const BOOLEAN_ORDER = ["entry", "tcas", "central_activity", "stage"] as const;
	const BOOLEAN_LABELS: Record<string, string> = {
		entry: "ลงทะเบียนเข้างาน",
		tcas: "TCAS",
		central_activity: "กิจกรรมส่วนกลาง",
		stage: "เวที",
	};

	const booths = $derived(
		checkpoints
			.filter((checkpoint) => checkpoint.type === "booth")
			.map(
				(checkpoint): Stamp => ({
					id: checkpoint.id,
					label: checkpoint.name ?? "บูธ",
					ink: INK.booth,
					done: checkpoint.completed,
				}),
			),
	);

	const workshopStamps = $derived.by(() => {
		// One stamp per workshop; attending any round counts.
		const byId: Record<string, Stamp> = {};
		for (const checkpoint of checkpoints) {
			if (checkpoint.type !== "workshop") continue;
			const key = checkpoint.workshopId ?? checkpoint.id;
			const label = checkpoint.workshopName ?? checkpoint.name ?? "เวิร์กช็อป";
			const existing = byId[key];
			byId[key] = {
				id: key,
				label,
				ink: INK.workshop,
				done: (existing?.done ?? false) || checkpoint.completed,
			};
		}
		return Object.values(byId);
	});

	/** Workshops the attendee has actually joined (walk-ins count) — never the whole catalog. */
	const collectedWorkshops = $derived(workshopStamps.filter((stamp) => stamp.done));

	/** Collected workshop titles, so bookings can be matched to their stamps. */
	const collectedWorkshopTitles = $derived(collectedWorkshops.map((stamp) => stamp.label));

	/** Booked in advance: each keeps a dashed slot until its stamp is collected. */
	const preregistered = $derived(
		registered
			.filter((registration) => registration.type === "advance")
			.map((registration) => ({
				id: `booking-${registration.slug}`,
				label: registration.title,
				ink: INK.workshop,
				done: collectedWorkshopTitles.includes(registration.title),
			})),
	);

	/** Joined on site: walk-in bookings first, then any collected stamp without an advance booking. */
	const onsite = $derived.by(() => {
		const slots: Record<string, Stamp> = {};
		// Advance bookings already render in their own row; a collected workshop there must not
		// also be re-added as a walk-in stamp.
		const taken: string[] = preregistered.map((slot) => slot.label);
		const add = (slot: Stamp) => {
			taken.push(slot.label);
			slots[slot.id] = slot;
		};
		for (const registration of registered.filter((r) => r.type === "walk-in"))
			add({
				id: `onsite-${registration.slug}`,
				label: registration.title,
				ink: INK.workshop,
				done: collectedWorkshopTitles.includes(registration.title),
			});
		for (const stamp of collectedWorkshops) {
			if (!taken.includes(stamp.label)) add({ ...stamp, id: `collected-${stamp.id}` });
		}
		return Object.values(slots);
	});

	const booleans = $derived(
		BOOLEAN_ORDER.filter((type) => checkpoints.some((checkpoint) => checkpoint.type === type)).map(
			(type) => ({
				id: type,
				label: BOOLEAN_LABELS[type],
				ink: INK[type],
				done: checkpoints.find((checkpoint) => checkpoint.type === type)?.completed ?? false,
			}),
		),
	);

	const activities = $derived([...booleans, ...workshopStamps]);
	const boothDone = $derived(booths.filter((stamp) => stamp.done).length);
	const activityDone = $derived(activities.filter((stamp) => stamp.done).length);

	// A little per-stamp wobble makes collected stamps read like real ink stamps.
	const ROTATIONS = ["-rotate-1", "rotate-1", "rotate-0", "rotate-[-1.5deg]"] as const;
	const rotation = (i: number) => ROTATIONS[i % ROTATIONS.length];

	function stampStyle(ink: string, done: boolean) {
		return done
			? `border-color:${ink};background:${ink}2e`
			: `border-color:${ink}73;background:transparent`;
	}
</script>

<section
	class="flex flex-col gap-3 rounded-xl border border-brand-sky/40 bg-brand-mist p-3"
	aria-label="ความคืบหน้า"
>
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-expanded={open}
		class="flex w-full items-center justify-between gap-2 text-left"
	>
		<span class="font-heading text-base font-medium text-brand-navy">ความคืบหน้า</span>
		<span class="flex items-center gap-2">
			<span class="text-xs text-brand-navy tabular-nums">
				บูธ {boothDone}/{booths.length} · กิจกรรม {activityDone}/{activities.length}
			</span>
			<img
				src={arrowRightIcon}
				alt=""
				class={cn("size-4 transition-transform", open ? "-rotate-90" : "rotate-90")}
			/>
		</span>
	</button>

	{#if open}
		<div class="flex flex-col gap-4">
			<div class="flex flex-col gap-1.5">
				<div class="flex items-baseline justify-between">
					<span class="text-sm font-medium text-brand-navy">บูธภาควิชา</span>
					<span class="text-xs text-brand-navy tabular-nums">
						{boothDone}/{booths.length}
					</span>
				</div>
				<div class="h-2 overflow-hidden rounded-full bg-brand-navy/15">
					<div
						class="h-full rounded-full bg-brand-yellow transition-[width]"
						style:width="{booths.length ? (boothDone / booths.length) * 100 : 0}%"
					></div>
				</div>
				{#if boothDone === booths.length && booths.length > 0}
					<p class="text-xs text-brand-brown">เก็บตราบูธครบแล้ว!</p>
				{/if}
				<ul class="grid grid-cols-3 gap-1.5 pt-1">
					{#each booths as stamp, i (stamp.id)}
						<li
							class={cn(
								"flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md border-2 px-1 py-1 text-center text-[10px] leading-tight break-words",
								rotation(i),
							)}
							style={stampStyle(stamp.ink, stamp.done)}
						>
							{#if stamp.done}
								<span class="text-xs leading-none font-bold" style:color={stamp.ink}>✓</span>
							{/if}
							<span class={cn("text-brand-navy", !stamp.done && "opacity-60")}>
								{stamp.label}
							</span>
						</li>
					{/each}
				</ul>
			</div>

			<div class="flex flex-col gap-1.5">
				<div class="flex items-baseline justify-between">
					<span class="text-sm font-medium text-brand-navy">กิจกรรม</span>
					<span class="text-xs text-brand-navy tabular-nums">
						{activityDone}/{activities.length}
					</span>
				</div>
				<div class="h-2 overflow-hidden rounded-full bg-brand-navy/15">
					<div
						class="h-full rounded-full bg-brand-yellow transition-[width]"
						style:width="{activities.length ? (activityDone / activities.length) * 100 : 0}%"
					></div>
				</div>
				{#if activityDone === activities.length && activities.length > 0}
					<p class="text-xs text-brand-brown">เก็บตรากิจกรรมครบแล้ว!</p>
				{/if}

				<ul class="flex flex-wrap gap-1.5 pt-1">
					{#each booleans as stamp, i (stamp.id)}
						<li
							class={cn(
								"flex min-h-9 flex-1 items-center justify-center gap-1 rounded-md border-2 px-1.5 py-1 text-center text-[10px] leading-tight",
								rotation(i),
							)}
							style={stampStyle(stamp.ink, stamp.done)}
						>
							{#if stamp.done}
								<span class="text-xs leading-none font-bold" style:color={stamp.ink}>✓</span>
							{/if}
							<span class={cn("text-brand-navy", !stamp.done && "opacity-60")}>
								{stamp.label}
							</span>
						</li>
					{/each}
				</ul>

				{#if preregistered.length + onsite.length > 0}
					<p class="pt-1 text-xs font-medium text-brand-navy">เวิร์กช็อป</p>
					<!-- Advance bookings first (a dashed slot until its stamp is collected), then
					     on-site joins; the row is flexible and never lists the whole catalog. -->
					<ul class="flex flex-wrap gap-1.5">
						{#each [...preregistered, ...onsite] as stamp, i (stamp.id)}
							<li
								class={cn(
									"flex min-h-11 min-w-14 items-center justify-center gap-1 rounded-md border-2 px-2 py-1 text-center text-[10px] leading-tight break-words",
									stamp.done ? "border-solid" : "border-dashed",
									rotation(i),
								)}
								style={stampStyle(stamp.ink, stamp.done)}
							>
								{#if stamp.done}
									<span class="text-xs leading-none font-bold" style:color={stamp.ink}>✓</span>
									<span class="text-brand-navy">{stamp.label}</span>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}

				<div class="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[10px] text-brand-navy">
					{#each BOOLEAN_ORDER as type (type)}
						<span class="flex items-center gap-1">
							<i class="size-2 rounded-full" style:background={INK[type]}></i>
							{BOOLEAN_LABELS[type]}
						</span>
					{/each}
					{#if workshopStamps.length > 0}
						<span class="flex items-center gap-1">
							<i class="size-2 rounded-full" style:background={INK.workshop}></i>
							เวิร์กช็อป
						</span>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</section>