<script lang="ts">
  import { page } from "$app/state";
  import { ko } from "$lib/i18n";
</script>

<svelte:head>
  <title>{ko.error.title}</title>
</svelte:head>

<section class="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 py-20 text-center">
  <p class="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">
    {page.status || ko.error.unknownStatus}
  </p>
  <h1 class="mt-6 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{ko.error.heading}</h1>
  <p class="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
    {page.error?.message ?? ko.error.fallbackMessage}
  </p>
  <a
    class="mt-10 rounded-full bg-pink-500 px-7 py-3 font-semibold text-white shadow-lg shadow-pink-200 transition hover:-translate-y-0.5 hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2"
    href="/"
    aria-label={ko.error.homeCta}
  >
    {ko.error.homeCta}
  </a>
</section>
