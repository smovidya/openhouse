<script lang="ts">
	import { onMount, untrack } from "svelte";
	import { dev } from "$app/env";
	import { page } from "$app/state";
	import { goto } from "$app/navigation";
	import { beginGoogleSignIn, createDevSession, signInWithGoogle } from "#lib/features/auth/auth.client.ts";
	import { loadGoogleIdentity, type GoogleIdentity } from "#lib/features/auth/google.client.ts";

	const session = $derived(page.data.session);
	let status = $state<"loading" | "ready" | "signing-in" | "error">("loading");
	let authError = $state("");
	let buttonVersion = $state(0);
	let google: GoogleIdentity | undefined;
	let disposed = false;
	let attempt = 0;

	async function startDevRegistration() {
		if (!dev || status === "signing-in") return;
		status = "signing-in";
		authError = "";
		try {
			await createDevSession({ profile: "newcomer" });
			await goto("/register", { invalidateAll: true });
		} catch {
			showError("ไม่สามารถสร้างบัญชีทดสอบได้ กรุณาลองอีกครั้ง");
		}
	}

	function showError(message: string) {
		if (disposed) return;
		authError = message;
		status = "error";
	}

	async function prepareSignIn() {
		if (disposed || session || status === "signing-in") return;
		const currentAttempt = ++attempt;
		status = "loading";
		authError = "";
		try {
			google = await loadGoogleIdentity();
			if (disposed || currentAttempt !== attempt) return;
			const { clientId, nonce } = await beginGoogleSignIn();
			if (disposed || currentAttempt !== attempt) return;
			google.initialize({
				client_id: clientId,
				ux_mode: "popup",
				nonce,
				auto_select: false,
				button_auto_select: false,
				callback: ({ credential }) => {
					if (currentAttempt === attempt) void completeSignIn(credential);
				},
			});
			buttonVersion += 1;
			status = "ready";
		} catch {
			showError("ไม่สามารถเตรียมการเข้าสู่ระบบได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง");
		}
	}

	function renderGoogleButton(container: HTMLDivElement) {
		try {
			google?.renderButton(container, {
				type: "standard",
				theme: "outline",
				size: "large",
				text: "continue_with",
			});
		} catch {
			showError("ไม่สามารถแสดงปุ่ม Google ได้ กรุณาลองอีกครั้ง");
		}
	}

	async function completeSignIn(credential: string) {
		if (disposed || session || status !== "ready") return;
		status = "signing-in";
		authError = "";
		try {
			// Wait for credential verification, the session cookie, and session refresh.
			const signedIn = await signInWithGoogle({ googleIdToken: credential });
			if (!disposed) {
				await goto(signedIn.user.attendee ? "/myid" : "/register", {
					invalidateAll: true,
					replaceState: true,
				});
			}
		} catch {
			showError("เข้าสู่ระบบไม่สำเร็จ กรุณาเลือกบัญชี Google และลองอีกครั้ง");
		}
	}

	function initializeGoogleSignIn() {
		// The signed-out section mounts again after logout, including on this page.
		untrack(() => void prepareSignIn());
	}

	onMount(() => {
		return () => {
			disposed = true;
			attempt += 1;
		};
	});

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

	<div id="register" class="w-full max-w-100.5 scroll-mt-24 px-3">
		{#if dev}
			<Button type="button" variant="cta" size="cta-lg" class="w-full" disabled={status === "signing-in"} onclick={startDevRegistration}>
				{status === "signing-in" ? "กำลังสร้างบัญชีทดสอบ..." : "ลงทะเบียน"}
			</Button>
			<p class="mt-2 text-center text-sm text-brand-mist">Development · เริ่มลงทะเบียนด้วยบัญชีทดสอบใหม่ทุกครั้ง</p>
			{#if authError}
				<p role="alert" class="mt-2 text-center text-sm text-brand-yellow">{authError}</p>
			{/if}
		{:else if session}
			<Button variant="cta" size="cta-lg" href={session.user.attendee ? "/myid" : "/register"} class="w-full">ลงทะเบียน</Button>
		{:else}
			<div class="flex flex-col items-center gap-3 text-center text-brand-mist" {@attach initializeGoogleSignIn}>
				<p class="text-sm">ลงทะเบียนด้วยบัญชี Google</p>
				<!-- Google's button opens its popup directly from the user's click. -->
				<div hidden={status !== "ready"}>
					{#key buttonVersion}
						<div {@attach renderGoogleButton}></div>
					{/key}
				</div>
				<p role="status" class="text-sm">
					{#if status === "loading"}
						กำลังเตรียมการเข้าสู่ระบบ...
					{:else if status === "signing-in"}
						กำลังตรวจสอบบัญชี Google...
					{/if}
				</p>
				{#if authError}
					<p role="alert" class="text-sm text-brand-yellow">{authError}</p>
				{/if}
				{#if status === "error"}
					<Button type="button" variant="cta" size="cta-sm" onclick={prepareSignIn}>ลองอีกครั้ง</Button>
				{/if}
			</div>
		{/if}
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
