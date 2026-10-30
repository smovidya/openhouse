<script lang="ts">
	import WorkshopLocation from "#lib/components/dashboard/workshop-location.svelte";
	import type { WorkshopPlace } from "#lib/features/dashboard/venue-workshops.ts";
	import { createQuery } from "@tanstack/svelte-query";
	import { getDashboardBoothFeed } from "#lib/features/dashboard/dashboard.remote.ts";
	import { matchesMapBooth } from "#lib/features/dashboard/venue-map.ts";
	import type { BoothStats, WorkshopStats } from "#lib/features/dashboard/types.ts";

	let { booths = [], workshops = [], now = Date.now() }: { booths?: BoothStats[]; workshops?: WorkshopStats[]; now?: number } = $props();
	let selected = $state<number | WorkshopPlace | "tcas" | null>(null);

	const workshopPlaces: { id: WorkshopPlace; x: number; y: number }[] = [
		{ id: "M1", x: 159, y: 477 }, { id: "M2", x: 237, y: 530 },
		{ id: "L1", x: 155, y: 524 }, { id: "L2", x: 194, y: 558 },
	];
	const workshopPlace = $derived(workshopPlaces.find((place) => place.id === selected));
	// Numbers and positions follow the organizer's ground-floor plan.
	const locations = [
		{ name: "Inprint", department: "imaging-printing", x: 337, y: 191 },
		{ name: "Chemtech", department: "chemical-technology", x: 337, y: 223 },
		{ name: "Bistech", department: "bistech", x: 337, y: 255 },
		{ name: "BBTech", department: "bbtech", x: 337, y: 287 },
		{ name: "Bsac", department: "bsac", x: 337, y: 319 },
		{ name: "Matsci", department: "materials-science", x: 399, y: 234 },
		{ name: "Foodtech", department: "food-technology", x: 438, y: 234 },
		{ name: "Micro", department: "microbiology", x: 419, y: 278 },
		{ name: "Botgen", department: "botany", x: 419, y: 319 },
		{ name: "Geo", department: "geology", x: 501, y: 191 },
		{ name: "Marine", department: "marine-science", x: 501, y: 223 },
		{ name: "Envi", department: "environmental-science", x: 501, y: 255 },
		{ name: "Biochem", department: "biochemistry", x: 501, y: 287 },
		{ name: "Biozoo", department: "biology", x: 501, y: 319 },
		{ name: "Mathcom", department: "math-cs", x: 344, y: 413 },
		{ name: "Chem", department: "chemistry", x: 319, y: 444 },
		{ name: "Physics", department: "physics", x: 294, y: 475 },
	];
	const mapped = $derived(locations.map((location, index) => {
		const checkpoints = booths.filter((booth) => matchesMapBooth(booth, location));
		return { ...location, number: index + 1, checkpointIds: checkpoints.map((checkpoint) => checkpoint.id).sort(), scans: checkpoints.length ? checkpoints.reduce((total, booth) => total + booth.scans, 0) : null };
	}));
	const tcas = $derived.by(() => {
		const checkpoints = booths.filter((booth) => booth.type === "tcas");
		return { name: "TCAS", number: null, checkpointIds: checkpoints.map((checkpoint) => checkpoint.id).sort(), scans: checkpoints.length ? checkpoints.reduce((sum, checkpoint) => sum + checkpoint.scans, 0) : null };
	});
	const current = $derived(selected === "tcas" ? tcas : mapped.find((booth) => booth.number === selected));
	const total = $derived(mapped.reduce((sum, booth) => sum + (booth.scans ?? 0), 0));
	const recent = createQuery(() => {
		const checkpointIds = current?.checkpointIds ?? [];
		return {
			queryKey: ["dashboard-booth-feed", checkpointIds],
			enabled: checkpointIds.length > 0,
			queryFn: async () => {
				const query = getDashboardBoothFeed(checkpointIds);
				await query.refresh();
				return await query;
			},
			refetchInterval: 5_000,
		};
	});
	const scanTime = new Intl.DateTimeFormat("th-TH", {
		hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Bangkok",
	});
</script>

<section class="venue" aria-label="แผนผังงาน Sciland">
	<header>
		<div>
			<p class="eyebrow">SCILAND · G FLOOR</p>
			<h2>แผนผังงาน</h2>
			<p class="subtitle">ชั้น G · จามจุรีสแควร์</p>
		</div>
		<div class="map-total"><strong>{total.toLocaleString("th-TH")}</strong><span>เช็คอินบูธภาควิชา</span></div>
	</header>
	<div class="map-layout">
		<div class="map-scroll">
			<div class="plan">
				<svg viewBox="0 0 850 650" role="img" aria-label="แผนผังชั้น G บูธภาควิชาอยู่ตรงกลางและด้านล่างซ้าย เวิร์กชอปด้านล่างซ้าย กิจกรรมกลางด้านล่างขวา">
					<defs>
						<pattern id="venue-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#304c64" opacity=".13" /></pattern>
					</defs>
					<rect width="850" height="650" fill="#f5f1e6" />
					<rect width="850" height="650" fill="url(#venue-grid)" />
					<g fill="#e7e6df" stroke="#9aacae" stroke-width="2">
						<path d="M54 83H796V566H54Z" fill="#fcfaf3" />
						<path d="M94 111H351L376 156 315 187 234 254H94Z" />
						<path d="M491 111H751V254H610L527 187 468 156Z" />
						<path d="M94 365L231 318 285 366 209 436 94 409Z" />
						<path d="M556 366L610 318 751 365V488L688 520 619 453Z" />
						<circle cx="628" cy="548" r="72" />
					</g>
					<g class="road-label" text-anchor="middle"><text x="425" y="49">ฝั่งบัญชี</text><text x="425" y="622">ฝั่งถนนพระราม 4</text></g>
					<rect x="692" y="86" width="92" height="24" rx="4" fill="#f3a9aa" />
					<text x="738" y="103" text-anchor="middle" class="small-label">Loading B</text>
					<g fill="#fcfaf3" stroke="#9aacae" stroke-width="2"><circle cx="185" cy="294" r="48" /><circle cx="657" cy="294" r="48" /></g>
					<g class="small-label" text-anchor="middle"><text x="185" y="291">↗</text><text x="185" y="309">บันไดเลื่อน</text><text x="657" y="291">↗</text><text x="657" y="309">บันไดเลื่อน</text><text x="112" y="137">ห้องน้ำ</text><text x="729" y="137">ห้องน้ำ</text></g>
					<path d="M303 181Q421 139 540 181L527 351Q421 382 316 351Z" fill="#b4dff0" stroke="#527b91" stroke-width="2.5" />
					<circle cx="421" cy="161" r="34" fill="#fcfaf3" stroke="#527b91" stroke-width="2" />
					<text x="421" y="158" text-anchor="middle" class="zone-label">↕</text><text x="421" y="177" text-anchor="middle" class="small-label">ลิฟต์แก้ว</text>
					<path d="M249 530L370 383V530Z" fill="#b4dff0" stroke="#527b91" stroke-width="2.5" />
					<g fill="#a8efa0" stroke="#5d9959" stroke-width="2"><rect x="318" y="503" width="20" height="20" rx="3" /><rect x="344" y="503" width="20" height="20" rx="3" /></g>
					<text x="340" y="550" class="small-label" text-anchor="middle">TCAS</text>
					<path d="M136 465Q171 409 225 442Q270 480 246 543Q207 584 145 556Q121 524 136 465Z" fill="#f9deed" stroke="#a37b98" stroke-width="2.5" />
					<g transform="rotate(-40 196 493)"><rect x="172" y="466" width="48" height="54" rx="14" fill="#fcfaf3" stroke="#a37b98" stroke-width="2" /><path d="M172 480H220 M172 493H220 M172 506H220" stroke="#a37b98" stroke-width="2" /></g>
					<g fill="#ffad70" stroke="#b56b40" stroke-width="1.5"><rect x="145" y="463" width="29" height="28" rx="4" /><rect x="141" y="510" width="29" height="28" rx="4" /><rect x="180" y="544" width="29" height="28" rx="4" /><rect x="223" y="516" width="29" height="28" rx="4" /></g>
					<g class="small-label" text-anchor="middle"><text x="159" y="482">M1</text><text x="155" y="529">L1</text><text x="194" y="563">L2</text><text x="237" y="535">M2</text><text x="191" y="605">WORKSHOP</text></g>
					<g transform="rotate(-17 532 462)">
						<path d="M466 413Q532 424 597 413V512Q530 525 466 512Z" fill="#d4efb4" stroke="#7d9b66" stroke-width="2.5" />
						<g stroke="#5c8b91" fill="#97e5e9"><rect x="498" y="427" width="20" height="20" rx="3" /><rect x="523" y="427" width="20" height="20" rx="3" /></g>
						<g fill="#f382cb" stroke="#a3558a"><rect x="473" y="427" width="20" height="20" rx="3" /><rect x="473" y="483" width="20" height="20" rx="3" /><rect x="500" y="483" width="20" height="20" rx="3" /></g>
						<rect x="559" y="431" width="27" height="69" rx="3" fill="#8fc3f6" stroke="#587ea2" /><text x="572" y="466" transform="rotate(90 572 466)" text-anchor="middle" class="tiny-label">Back Drop</text>
						<circle cx="538" cy="493" r="11" fill="#263c37" /><text x="538" y="497" fill="#d4efb4" text-anchor="middle" font-size="13">◎</text>
					</g>
					<text x="537" y="551" class="small-label" text-anchor="middle">กิจกรรมกลาง</text>
				</svg>
				{#each mapped as booth (booth.number)}
					<button type="button" class={["map-booth", { selected: selected === booth.number }]} style:left="{booth.x / 8.5}%" style:top="{booth.y / 6.5}%" aria-label="บูธ {booth.number} {booth.name}" aria-pressed={selected === booth.number} onclick={() => selected = booth.number}>{booth.number}</button>
				{/each}
				<button type="button" class={["map-booth", "tcas-marker", { selected: selected === "tcas" }]} style:left="40%" style:top="{513 / 6.5}%" aria-label="บูธ TCAS" aria-pressed={selected === "tcas"} onclick={() => selected = "tcas"}>TCAS</button>
				{#each workshopPlaces as place (place.id)}
					<button type="button" class={["map-booth", "workshop-marker", { selected: selected === place.id }]} style:left="{place.x / 8.5}%" style:top="{place.y / 6.5}%" aria-label="Workshop {place.id}" aria-pressed={selected === place.id} onclick={() => selected = place.id}>{place.id}</button>
				{/each}
			</div>
		</div>
		<aside>
			{#if workshopPlace}
				<WorkshopLocation place={workshopPlace.id} {workshops} {now} />
			{:else}
			<div class="selection" aria-live="polite">
				{#if current}
					<span class="eyebrow">บูธ {current.number === null ? "TCAS" : current.number.toString().padStart(2, "0")}</span>
					<h3>{current.name}</h3>
					{#if current.scans === null}
						<p>ยังไม่มีจุดเช็คอินสำหรับบูธนี้</p>
					{:else}
						<div class="booth-stats">
							<div><strong>{current.scans.toLocaleString("th-TH")}</strong><span>เช็คอินสะสม</span></div>
							{#if current.number !== null}<div><strong>{total ? (current.scans / total * 100).toFixed(1) : "0.0"}%</strong><span>ของเช็คอินภาควิชา</span></div>{/if}
						</div>
						<h4>สแกนล่าสุด · บูธ {current.number ?? "TCAS"}</h4>
						{#if recent.isPending}
							<p>กำลังโหลดสแกนล่าสุด…</p>
						{:else if recent.isError}
							<p role="alert">โหลดสแกนล่าสุดไม่สำเร็จ กำลังลองใหม่</p>
						{:else}
							<ol class="recent-scans">
								{#each recent.data ?? [] as scan (scan.id)}
									<li><span>{scan.firstname} {scan.lastnameInitial}</span><time datetime={scan.createdAt} title={new Date(scan.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}>{scanTime.format(new Date(scan.createdAt))}</time></li>
								{:else}
									<li>ยังไม่มีการสแกนที่บูธนี้</li>
								{/each}
							</ol>
						{/if}
					{/if}
				{:else}
					<span class="eyebrow">EXPLORE THE FLOOR</span>
					<h3>17 ภาควิชา · 1 แผนที่</h3>
					<p>เลือกบูธเพื่อดูสถิติและสแกนล่าสุด หรือเลือก M1 / M2 / L1 / L2 เพื่อดูเวิร์กชอป</p>
				{/if}
			</div>
			{/if}
			<div class="booth-list" aria-label="รายชื่อบูธภาควิชา">
				{#each mapped as booth (booth.number)}
					<button type="button" class={{ active: selected === booth.number }} aria-pressed={selected === booth.number} onclick={() => selected = booth.number}><span class="number">{booth.number}</span>{booth.name}<span class="scans">{booth.scans?.toLocaleString("th-TH") ?? "—"}</span></button>
				{/each}
			</div>
			<button type="button" class={["tcas-list", { active: selected === "tcas" }]} aria-pressed={selected === "tcas"} onclick={() => selected = "tcas"}><span>TCAS</span><span class="scans">{tcas.scans?.toLocaleString("th-TH") ?? "—"} เช็คอิน</span></button>
		</aside>
	</div>
	<footer>
		<div class="legend" aria-label="สัญลักษณ์"><span><i style:background="#ffec9f"></i>บูธภาควิชา</span><span><i style:background="#97e5e9"></i>กิจกรรมกลาง</span><span><i style:background="#f382cb"></i>ทะเบียน / ของที่ระลึก / Merch</span><span><i style:background="#ffad70"></i>Workshop</span><span><i style:background="#a8efa0"></i>TCAS</span><span><i style:background="#8fc3f6"></i>Back Drop</span><span><i style:background="#263c37"></i>Photo Booth</span></div>
		<p>ผังอ้างอิงจากแผนงาน · ไม่อิงมาตราส่วน · ยอดเช็คอินสะสม ไม่ใช่จำนวนคน ณ จุดนั้น</p>
	</footer>
</section>

<style>
	.venue { border: 1px solid #ffffff20; border-radius: 1rem; overflow: hidden; background: #152c46; color: #eef3f7; }
	header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.25rem 1.5rem; }
	.eyebrow { color: #f9cf57; font-size: .65rem; letter-spacing: .14em; }
	h2 { font-size: 1.5rem; margin: .2rem 0; }
	.subtitle, .map-total span { font-size: .75rem; color: #c1d0dc; }
	.map-total { display: flex; flex-direction: column; text-align: right; }
	.map-total strong { font-size: 1.8rem; color: #f9cf57; font-variant-numeric: tabular-nums; }
	.map-layout { display: grid; grid-template-columns: minmax(0, 1fr) 270px; border-block: 1px solid #ffffff20; }
	.map-scroll { overflow-x: auto; background: #f5f1e6; }
	.plan { position: relative; min-width: 530px; }
	svg { display: block; width: 100%; height: auto; }
	svg text { fill: #334658; font-family: inherit; }
	.road-label { font-size: 15px; }
	.small-label { font-size: 13px; }
	.tiny-label { font-size: 10px; }
	.zone-label { font-size: 28px; }
	.map-booth { position: absolute; transform: translate(-50%, -50%); width: 3.6%; aspect-ratio: 1; background: #ffec9f; color: #334658; border: 1px solid #9b8b4e; border-radius: 4px; font-size: clamp(10px, 1.1vw, 15px); font-weight: 600; cursor: pointer; box-shadow: 0 2px 0 #33465825; }
	.workshop-marker { background: #ffad70; border-color: #b56b40; font-size: .65rem; }
	.tcas-marker { width: 6.5%; aspect-ratio: auto; min-height: 24px; background: #a8efa0; border-color: #5d9959; font-size: .65rem; }
	.tcas-list { display: flex; align-items: center; justify-content: space-between; width: 100%; margin-top: .75rem; padding: .6rem; border: 1px solid #a8efa060; border-radius: .35rem; color: #a8efa0; font-size: .75rem; cursor: pointer; }
	.tcas-list:hover, .tcas-list.active { background: #a8efa015; border-color: #a8efa0; }
	.map-booth:hover, .map-booth.selected { background: #213a62; color: #fff; box-shadow: 0 0 0 3px #f9cf57; z-index: 1; }
	button:focus-visible { outline: 3px solid #3682b6; outline-offset: 3px; z-index: 2; }
	aside { padding: 1rem; }
	.selection { min-height: 108px; padding: .25rem .25rem 1rem; border-bottom: 1px solid #ffffff20; }
	h3 { font-size: 1.15rem; margin: .35rem 0; color: #fff; }
	.selection p { font-size: .75rem; color: #c1d0dc; line-height: 1.6; }
	.booth-stats { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; margin: .75rem 0; }
	.booth-stats div { display: flex; flex-direction: column; }
	.booth-stats strong { font-size: 1.3rem; color: #f9cf57; font-variant-numeric: tabular-nums; }
	.booth-stats span { font-size: .65rem; color: #c1d0dc; }
	h4 { margin-top: 1rem; font-size: .75rem; }
	.recent-scans { margin-top: .5rem; max-height: 180px; overflow-y: auto; font-size: .7rem; }
	.recent-scans li { display: flex; justify-content: space-between; gap: .5rem; padding: .35rem 0; border-bottom: 1px solid #ffffff10; }
	.recent-scans time { color: #c1d0dc; font-variant-numeric: tabular-nums; }
	.booth-list { display: grid; grid-template-columns: 1fr 1fr; gap: .25rem; margin-top: .75rem; }
	.booth-list button { display: flex; align-items: center; gap: .35rem; padding: .4rem .25rem; border: 1px solid transparent; border-radius: .35rem; font-size: .7rem; cursor: pointer; text-align: left; }
	.booth-list button:hover, .booth-list button.active { border-color: #f9cf5770; background: #ffffff0d; }
	.number { display: grid; place-items: center; width: 1.25rem; height: 1.25rem; flex-shrink: 0; border-radius: .25rem; color: #ffec9f; background: #ffec9f15; font-size: .65rem; }
	.scans { margin-left: auto; color: #a3b8c8; font-size: .6rem; font-variant-numeric: tabular-nums; }
	footer { padding: 1rem 1.5rem; }
	.legend { display: flex; flex-wrap: wrap; gap: .6rem 1.2rem; font-size: .7rem; }
	.legend span { display: flex; align-items: center; gap: .4rem; }
	i { width: .7rem; height: .7rem; border-radius: .2rem; border: 1px solid #ffffff40; }
	footer p { font-size: .65rem; color: #a3b8c8; margin-top: .75rem; }
	@media (max-width: 900px) { .map-layout { grid-template-columns: 1fr; } .booth-list { grid-template-columns: repeat(4, 1fr); } .selection { min-height: auto; } }
	@media (max-width: 540px) { header { padding: 1rem; } .booth-list { grid-template-columns: repeat(3, 1fr); } .map-total strong { font-size: 1.4rem; } .map-total span { font-size: .6rem; } footer { padding: 1rem; } }
</style>
