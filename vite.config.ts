import tailwindcss from "@tailwindcss/vite";
import adapter from "@sveltejs/adapter-cloudflare";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: {
    // Pre-bundle at startup what Vite would otherwise discover on first visit to a page. Discovering
    // them late makes the dev server re-optimize and reload the page mid-navigation (e.g. the dev
    // toolbar's "New registration" landing back on / instead of /register: a flaky e2e test).
    include: [
      "@tanstack/svelte-query",
      "bits-ui",
      "cn",
      "neverthrow",
      "runed",
      "tailwind-variants",
      "vaul-svelte",
      // /register
      "@lucide/svelte/icons/check",
      "@lucide/svelte/icons/chevron-down",
      "@lucide/svelte/icons/chevron-up",
      "@lucide/svelte/icons/circle",
      "@lucide/svelte/icons/minus",
      "@lucide/svelte/icons/square",
      "@lucide/svelte/icons/square-check",
      "formsnap",
      "sveltekit-superforms",
      "sveltekit-superforms/adapters",
      "zod",
      // /myid
      "qrcode",
    ],
  },
  plugins: [
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
        experimental: {
          async: true,
        },
      },

      // adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
      // If your environment is not supported, or you settled on a specific environment, switch out the adapter.
      // See https://svelte.dev/docs/kit/adapters for more information about adapters.
      // Development auth fixtures must never write to remote bindings.
      adapter: adapter({ platformProxy: { remoteBindings: false } }),
      experimental: {
        remoteFunctions: true,
      },
    }),
  ],
});
