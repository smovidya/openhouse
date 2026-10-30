<script lang="ts">
	import { venueWorkshopSchedule, type WorkshopPlace } from "#lib/features/dashboard/venue-workshops.ts";
	import type { WorkshopStats } from "#lib/features/dashboard/types.ts";

	let { place, workshops, now }: { place: WorkshopPlace; workshops: WorkshopStats[]; now: number } = $props();
	const schedule = $derived(venueWorkshopSchedule(place, workshops, now));
	const running = $derived(schedule.flatMap((workshop) => workshop.rounds.filter((round) => round.status === "running").map((round) => ({ workshop, round }))));
	const zone = $derived(place.startsWith("M") ? "M1 / M2" : "L1 / L2");
	const dateTime = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
	const time = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
	const statusLabels: Record<string, string> = { running: "กำลังจัด", upcoming: "ยังไม่เริ่ม", ended: "จบแล้ว" };
</script>

<section class="workshop-details" aria-label="รายละเอียดเวิร์กชอป {place}">
	<p class="eyebrow">WORKSHOP · {place}</p>
	<h3>ตารางโซน {zone}</h3>
	<p class="note">ตารางรวมของพื้นที่ {zone} · ยังไม่แยกรายสถานี</p>
	<p class="clock">ณ {dateTime.format(new Date(now))} น.</p>
	<h4>กำลังจัดตอนนี้</h4>
	{#each running as { workshop, round } (workshop.slug + round.roundNumber)}
		<div class="running">
			<strong>{workshop.host} · {workshop.title}</strong>
			<p>{workshop.activity}</p>
			<p>รอบ {round.roundNumber} · {time.format(new Date(round.startsAt))}–{time.format(new Date(round.endsAt))} น.</p>
			<p>{round.registered === null ? `รับ ${round.capacity} คน · ยังไม่มียอดจอง` : `ลงทะเบียน ${round.registered} / ${round.capacity} คน`}</p>
		</div>
	{:else}
		<p class="note">ไม่มีเวิร์กชอปกำลังจัดในโซนนี้</p>
	{/each}
	<h4>เวิร์กชอปทั้งหมดในโซน</h4>
	{#each schedule as workshop (workshop.slug)}
		<details>
			<summary><strong>{workshop.host}</strong><span>{workshop.activity}</span></summary>
			<p class="description">{workshop.description}</p>
			<ol>
				{#each workshop.rounds as round (round.roundNumber)}
					<li class={{ "running-round": round.status === "running" }}>
						<span class="status">{statusLabels[round.status]}</span>
						<span>รอบ {round.roundNumber} · {dateTime.format(new Date(round.startsAt))}–{time.format(new Date(round.endsAt))} น.</span>
						<span>{round.registered === null ? `รับ ${round.capacity} คน` : `${round.registered} / ${round.capacity} คน · จอง ${round.advance} · Walk-in ${round.walkIn}`}</span>
					</li>
				{:else}
					<li>ยังไม่มีรอบในระบบ</li>
				{/each}
			</ol>
		</details>
	{/each}
</section>

<style>
	.workshop-details { border-bottom: 1px solid #ffffff20; padding-bottom: 1rem; font-size: .75rem; }
	.eyebrow { color: #f9cf57; letter-spacing: .12em; font-size: .65rem; }
	h3 { margin: .4rem 0; font-size: 1.15rem; }
	h4 { margin: 1rem 0 .5rem; color: #f9cf57; }
	.note, .clock { color: #c1d0dc; font-size: .65rem; line-height: 1.6; }
	.clock { margin-top: .5rem; }
	.running { padding: .6rem; border: 1px solid #8cdda660; background: #8cdda610; border-radius: .5rem; margin-bottom: .5rem; }
	.running p { margin-top: .3rem; line-height: 1.6; }
	details { border-top: 1px solid #ffffff20; padding: .6rem 0; }
	summary { cursor: pointer; line-height: 1.7; }
	summary span { display: block; color: #c1d0dc; font-size: .7rem; }
	summary:focus-visible { outline: 2px solid #f9cf57; outline-offset: 3px; }
	.description { margin: .6rem 0; line-height: 1.8; color: #c1d0dc; }
	ol { display: grid; gap: .4rem; }
	li { display: grid; gap: .2rem; font-size: .65rem; background: #ffffff08; padding: .45rem; border-radius: .3rem; }
	.running-round { background: #8cdda615; }
	.status { color: #f9cf57; }
</style>
