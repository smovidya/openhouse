<script lang="ts">
	import MenuIcon from "@lucide/svelte/icons/menu";
	import logo from "#lib/assets/logo.png";
	import { cn } from "#lib/utils.js";

	let { class: className }: { class?: string } = $props();
</script>

<header class={cn("flex w-full items-start justify-between bg-black/30 px-6 py-4", className)}>
	<a href="/" class="block h-[40.078px] w-10">
		<img src={logo} alt="Science Chula Openhouse" class="size-full object-cover" />
	</a>
	<button
		type="button"
		aria-label="เมนู"
		class="grid size-10 place-items-center rounded-lg p-1 text-brand-mist outline-none focus-visible:ring-3 focus-visible:ring-brand-mist/50"
	>
		<MenuIcon class="size-8" />
	</button>
</header>
