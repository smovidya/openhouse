<script lang="ts">
 import { toolbarPosition, toolbarPositions } from "#lib/dev-settings.svelte.js";
 import DevControls from "./dev-controls.svelte";

 let open = $state(false);
 let trigger: HTMLButtonElement;
 const position = $derived(toolbarPositions.includes(toolbarPosition.current) ? toolbarPosition.current : "bottom-center");
 function close() {
  open = false;
  trigger?.focus();
 }
</script>

<svelte:window onkeydown={(event) => {
 if (open && event.key === "Escape") close();
}} />

<aside class="dev-toolbar" data-position={position} aria-label="Development tools">
 <button class="trigger" type="button" {@attach (element) => { trigger = element; }} aria-expanded={open} aria-controls="dev-toolbar-panel" onclick={() => open = !open}>
  <span class="dot"></span><strong>DEV</strong><span>{open ? "Close tools ×" : "Open tools"}</span>
 </button>
 {#if open}
  <section id="dev-toolbar-panel" class="panel" aria-label="Dev settings">
   <header><strong>Development tools</strong><button type="button" onclick={close} aria-label="Close dev toolbar">×</button></header>
   <DevControls />
  </section>
 {/if}
</aside>

<style>
 .dev-toolbar { position: fixed; z-index: 9999; display: flex; flex-direction: column; gap: 8px; width: max-content; max-width: calc(100vw - 24px); color: #fafafa; font: 12px/1.5 ui-monospace, monospace; }
 .dev-toolbar[data-position^="bottom"] { bottom: max(12px, env(safe-area-inset-bottom)); flex-direction: column-reverse; }
 .dev-toolbar[data-position^="top"] { top: max(12px, env(safe-area-inset-top)); }
 .dev-toolbar[data-position$="left"] { left: 12px; align-items: flex-start; }
 .dev-toolbar[data-position$="right"] { right: 12px; align-items: flex-end; }
 .dev-toolbar[data-position$="center"] { left: 50%; transform: translateX(-50%); align-items: center; }
 .trigger { display: flex; align-items: center; gap: 12px; border: 1px solid #52525b; border-radius: 999px; background: #18181b; padding: 10px 16px; box-shadow: 0 4px 24px #0005; cursor: pointer; color: #fafafa; }
 .trigger span:last-child { color: #a1a1aa; }
 .dot { width: 6px; height: 6px; border-radius: 50%; background: #a3e635; box-shadow: 0 0 10px #a3e63566; }
 .panel { width: min(370px, calc(100vw - 24px)); max-height: calc(100dvh - 90px); overflow: auto; overscroll-behavior: contain; border: 1px solid #52525b; border-radius: 16px; background: #18181b; box-shadow: 0 12px 48px #0008; }
 header { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; border-bottom: 1px solid #3f3f46; }
 header button { background: transparent; border: 0; color: #a1a1aa; padding: 4px 8px; font-size: 20px; cursor: pointer; }
 button:focus-visible { outline: 2px solid #a3e635; outline-offset: 3px; }
</style>
