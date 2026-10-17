<script lang="ts">
 import DevControls from "#lib/components/dev-controls.svelte";
 import Glass from "#lib/render/glass.svelte";
</script>

<svelte:head><title>Dev settings</title></svelte:head>
<main class="mx-auto w-full max-w-xl p-4">
 <h1 class="mb-4 text-xl">Dev settings</h1>
 <DevControls />

 <!-- Over the page's water (not inside the dark toolbar panel), so every glass mode shows as on real pages. -->
 <section class="mt-6 flex flex-col gap-3">
  <h2 class="text-base">&lt;Glass&gt; preview</h2>
  <div class="grid grid-cols-2 gap-3 text-brand-mist">
   <Glass class="flex h-28 flex-col justify-end rounded-lg p-3">variant="dark"</Glass>
   <Glass variant="light" class="flex h-28 flex-col justify-end rounded-lg p-3">variant="light"</Glass>
   <Glass class="col-span-2 rounded-full px-4 py-3 text-center">rounded-full</Glass>
   <Glass class="flex h-48 items-end rounded-3xl p-4">rounded-3xl, tall</Glass>
   <Glass options={{ highlightWidth: 2, highlightAlpha: 0.8 }} class="flex h-48 items-end rounded-xl p-4">
    options: highlightWidth 2, alpha 0.8
   </Glass>
  </div>
 </section>
</main>
