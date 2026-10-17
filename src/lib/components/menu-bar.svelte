<script lang="ts">
	import { Collapsible } from "bits-ui";
	import { afterNavigate } from "$app/navigation";
	import giftIcon from "#lib/assets/icons/gift.svg";
	import homeIcon from "#lib/assets/icons/home.svg";
	import labPanelIcon from "#lib/assets/icons/lab-panel.svg";
	import menuIcon from "#lib/assets/icons/menu.svg";
	import qrCodeBarIcon from "#lib/assets/icons/qr-code-bar.svg";
	import qrCodeIcon from "#lib/assets/icons/qr-code.svg";
	import logo from "#lib/assets/logo.png";
	import { Button } from "#lib/components/ui/button/index.js";
	import { cn } from "#lib/utils.js";

	type Props = {
		/** TODO: placeholder until auth exists; drive from the session instead. */
		loggedIn?: boolean;
		class?: string;
	};

	let { loggedIn = true, class: className }: Props = $props();

	type NavLink = { href: string; label: string; icon: string };

	// TODO: hrefs are placeholders until these pages exist.
	const links: NavLink[] = $derived(
		loggedIn
			? [
					{ href: "/", label: "หน้าแรก", icon: homeIcon },
					{ href: "/myid", label: "MY QR CODE", icon: qrCodeIcon },
					{ href: "/workshop", label: "Workshop", icon: labPanelIcon },
					{ href: "/prize", label: "ภารกิจล่าของรางวัล", icon: giftIcon },
				]
			: [{ href: "/", label: "หน้าแรก", icon: homeIcon }]
	);

	let open = $state(false);
	let headerHeight = $state(72);

	afterNavigate(() => {
		open = false;
	});

	// Lock page scroll while the menu overlays it.
	$effect(() => {
		if (!open) return;
		const { overflow } = document.documentElement.style;
		document.documentElement.style.overflow = "hidden";
		return () => {
			document.documentElement.style.overflow = overflow;
		};
	});

	const barButtonClass =
		"p-1 text-brand-mist hover:bg-white/10 hover:text-brand-mist active:bg-white/20 aria-expanded:bg-white/10 aria-expanded:text-brand-mist focus-visible:border-transparent focus-visible:ring-brand-mist/50 dark:hover:bg-white/10";

	const navLinkClass =
		"flex w-full items-center gap-3 rounded-lg p-3 font-heading text-xl font-medium text-brand-mist transition-colors outline-none hover:bg-white/10 focus-visible:bg-white/10 active:bg-white/20 focus-visible:ring-3 focus-visible:ring-brand-mist/50";

	function logout() {
		// TODO: sign out once auth exists.
		open = false;
	}
</script>

<svelte:window onkeydown={(event) => event.key === "Escape" && (open = false)} />

<!-- Reserves the closed bar's height so the open menu overlays the page instead of pushing it down. -->
<div class={cn("sticky top-0 z-50 h-[72px] w-full shrink-0", className)}>
	{#if open}
		<!-- Dims only the page below the open menu (Figma), so the menu's own translucent fill
		     isn't darkened by it. A sibling of <header>, not a child: the header's backdrop-filter
		     would stop a nested blur from reaching the page. -->
		<button
			type="button"
			aria-label="ปิดเมนู"
			tabindex="-1"
			class="absolute inset-x-0 h-dvh cursor-default bg-black/55 backdrop-blur-sm"
			style:top="{headerHeight}px"
			onclick={() => (open = false)}
		></button>
	{/if}
	<Collapsible.Root bind:open>
		<header
			bind:offsetHeight={headerHeight}
			class="absolute inset-x-0 top-0 flex flex-col items-center gap-8 border-b border-white/30 bg-black/30 px-6 py-4 shadow-md shadow-black/10 backdrop-blur-xl backdrop-saturate-125"
		>
			<div class="flex w-full items-start justify-between">
				<a href="/" class="block h-[40.078px] w-10">
					<img src={logo} alt="Science Chula Openhouse" class="size-full object-cover" />
				</a>
				<div class="flex items-center gap-3">
					{#if loggedIn && !open}
						<Button
							href="/myid"
							aria-label="MY QR CODE"
							variant="ghost"
							size="icon-lg"
							class={barButtonClass}
						>
							<img src={qrCodeBarIcon} alt="" />
						</Button>
					{/if}
					<Collapsible.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
								variant="ghost"
								size="icon-lg"
								class={barButtonClass}
							>
								<img src={menuIcon} alt="" />
							</Button>
						{/snippet}
					</Collapsible.Trigger>
				</div>
			</div>

			<Collapsible.Content class="flex w-full flex-col items-center gap-8">
				<!-- Links span the full 52px row (28px + p-3) so the gap is clickable; negative margins keep Figma's spacing. -->
				<nav class="-mx-1 -my-3 flex w-[calc(100%+0.5rem)] flex-col">
					{#each links as link (link.href)}
						<a
							href={link.href}
							class={navLinkClass}
						>
							<img src={link.icon} alt="" class="shrink-0" />
							<span class="min-w-0 mt-1 flex-1">{link.label}</span>
						</a>
					{/each}
					{#if import.meta.env.DEV}
						<a href="/settings" class={navLinkClass}>
							<span class="size-7 shrink-0"></span>
							<span class="mt-1 min-w-0 flex-1">Dev settings</span>
						</a>
					{/if}
				</nav>
				{#if loggedIn}
					<Button variant="cta" size="cta-sm" onclick={logout}>ออกจากระบบ</Button>
				{:else}
					<!-- TODO: point at the login page once it exists. -->
					<Button variant="cta" size="cta-sm" href="/register">เข้าสู่ระบบ / ลงทะเบียน</Button>
				{/if}
			</Collapsible.Content>
		</header>
	</Collapsible.Root>
</div>
