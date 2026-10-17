<script lang="ts">
	import logo from "#lib/assets/logo.png";
	import Countdown from "#lib/components/countdown.svelte";
	import Glass from "#lib/render/glass.svelte";
	import { Button } from "#lib/components/ui/button/index.js";

	const EVENT_START = "2026-10-31T13:00:00+07:00";
</script>

<svelte:head>
	<title>Sci CU Open House 2027</title>
</svelte:head>

<!-- Content is capped at the 402px design width; the countdown ropes run edge to edge. -->
<main class="flex w-full flex-col items-center gap-6 pt-6 pb-4">
	<img src={logo} alt="Sci CU Open House 2027" class="size-62.75 object-cover" />

	<Countdown target={EVENT_START} />

	<div class="w-full max-w-100.5 px-3">
		<Button variant="cta" size="cta-lg" href="/register" class="w-full">ลงทะเบียน</Button>
	</div>

	<div class="w-full max-w-100.5 p-3">
		<Glass as="section" class="flex flex-col items-center gap-3 rounded-xl p-3">
			<div class="w-full text-brand-yellow">
				<h1 class="text-2xl font-semibold">Sci CU Open House 2027</h1>
				<p class="text-sm">งานเปิดบ้านคณะวิทยาศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย 2569</p>
			</div>
			<div class="flex w-full flex-col gap-[1lh] text-sm text-brand-mist">
				<p class="indent-8">
					ในมหาสมุทรแห่งวิทยาศาสตร์ มีหมู่เกาะมากมายที่รอให้ค้นพบ แต่ละเกาะมีเรื่องราว ความรู้
					และเส้นทางการผจญภัยที่แตกต่างกัน ปีนี้น้องๆจะได้สวมบทเป็นโจรสลัดหน้าใหม่ ออกเดินทางสำรวจ 5
					หมู่เกาะหลัก จากคณะวิทยาศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย ได้แก่ เกาะกายภาพ เกาะชีวภาพ เกาะเทคโนโลยี
					เกาะวิทยาศาสตร์ธรรมชาติ และเกาะนานาชาติ
				</p>
				<p class="indent-8">
					น้องๆ อาจไม่ได้พบเกาะที่ใช่ตั้งแต่ครั้งแรก บางเกาะอาจทำให้รู้สึกว่า “นี่แหละสิ่งที่ชอบ”
					ขณะที่บางเกาะอาจทำให้ค้นพบว่า “อันนี้ไม่ใช่เรา” แต่ไม่ว่าการเดินทางจะพาไปที่ไหน
					ทุกก้าวล้วนเป็นประสบการณ์ที่ทำให้น้องได้รู้จักโลกวิทยาศาสตร์ และรู้จักตัวเองมากขึ้น ตลอดการเดินทาง
					พี่เสือ ในฐานะกัปตัน จะคอยนำทางและพาน้องๆออกสำรวจแต่ละเกาะ เพื่อค้นหาว่า
				</p>
			</div>
			<p class="text-center font-heading text-xl text-brand-yellow italic">
				“เกาะไหนคือเกาะที่ใช่สำหรับเรา”
			</p>
		</Glass>
	</div>

	<div class="w-full max-w-[402px] px-3">
		<Glass as="section" class="flex flex-col items-center gap-2 rounded-xl p-3 text-brand-mist">
			<h2 class="text-2xl font-medium text-brand-yellow">กำหนดการ</h2>
			<dl class="grid w-full grid-cols-[auto_auto] justify-between gap-x-4">
				<dt>วันเสาร์ที่ 31 ตุลาคม 2569</dt>
				<dd>เวลา 13.00 - 20.00 น.</dd>
				<dt>วันอาทิตย์ที่ 1 พฤศจิกายน 2569</dt>
				<dd>เวลา 09.00 - 17.00 น.</dd>
			</dl>
			<p class="text-center">ณ จามจุรีสแควร์ ชั้น G</p>
		</Glass>
	</div>
</main>