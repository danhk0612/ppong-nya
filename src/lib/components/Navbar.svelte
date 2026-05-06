<script lang="ts">
  import type { Session } from "@auth/sveltekit";
  import { ko } from "$lib/i18n";
  import { primaryNavigation } from "$lib/navigation";
  import AuthNavigation from "./AuthNavigation.svelte";

  let { session }: { session: Session | null } = $props();
</script>

<header class="sticky top-0 z-40 border-b border-white/70 bg-cream-50/90 backdrop-blur-xl">
  <nav class="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8" aria-label={ko.app.navigationLabel}>
    <a class="flex min-w-0 items-center gap-3 font-black tracking-tight text-ink-950" href="/">
      <span class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-500 text-lg text-white shadow-brand">
        {ko.app.logoKana}
      </span>
      <span class="truncate text-lg sm:text-xl">{ko.app.name}</span>
    </a>

    <div class="hidden items-center gap-1 rounded-full border border-white bg-white/80 p-1 text-sm font-bold text-ink-600 shadow-soft md:flex">
      {#each primaryNavigation as item}
        <a class="rounded-full px-4 py-2 transition hover:bg-brand-50 hover:text-brand-700" href={item.href}>{item.label}</a>
      {/each}
    </div>

    <AuthNavigation {session} />
  </nav>

  <div class="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3 text-sm font-bold text-ink-600 md:hidden">
    {#each primaryNavigation as item}
      <a class="shrink-0 rounded-full border border-white bg-white/80 px-4 py-2 shadow-soft" href={item.href}>{item.label}</a>
    {/each}
  </div>
</header>
