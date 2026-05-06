<script lang="ts">
  import "../app.css";
  import { primaryNavigation } from "$lib/navigation";
  import AuthNavigation from "$lib/components/AuthNavigation.svelte";
  import { ko } from "$lib/i18n";

  let { data } = $props();
</script>

<svelte:head>
  <title>{ko.app.title}</title>
  <meta
    name="description"
    content={ko.app.description}
  />
</svelte:head>

<div class="min-h-screen bg-slate-50 text-slate-950">
  <header class="sticky top-0 z-20 border-b border-white/60 bg-white/85 backdrop-blur">
    <nav class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4" aria-label={ko.app.navigationLabel}>
      <a class="flex items-center gap-3 font-semibold tracking-tight" href="/">
        <span class="grid h-10 w-10 place-items-center rounded-2xl bg-pink-500 text-lg text-white shadow-lg shadow-pink-200">
          {ko.app.logoKana}
        </span>
        <span class="text-xl">{ko.app.name}</span>
      </a>

      <div class="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
        {#each primaryNavigation as item}
          <a class="transition hover:text-pink-600" href={item.href}>{item.label}</a>
        {/each}
      </div>

      <AuthNavigation session={data.session} />
    </nav>
  </header>

  <main>
    <slot />
  </main>
</div>
