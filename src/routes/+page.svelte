<script lang="ts">
  import { ko } from "$lib/i18n";

  const highlights = ko.home.highlights;
</script>

<section class="relative isolate overflow-hidden">
  <div class="absolute inset-x-0 top-0 -z-10 h-96 bg-gradient-to-br from-pink-100 via-white to-sky-100"></div>
  <div class="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-28">
    <div>
      <p class="mb-5 inline-flex rounded-full border border-pink-200 bg-white/70 px-4 py-2 text-sm font-semibold text-pink-700 shadow-sm">
        {ko.home.eyebrow}
      </p>
      <h1 class="text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">
        {ko.home.title}
      </h1>
      <p class="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
        {ko.home.description}
      </p>
      <div class="mt-10 flex flex-col gap-3 sm:flex-row">
        <a
          class="rounded-full bg-pink-500 px-7 py-3 text-center font-semibold text-white shadow-lg shadow-pink-200 transition hover:-translate-y-0.5 hover:bg-pink-600"
          href="/login"
          aria-label={ko.login.googleCtaLabel}
        >
          {ko.home.loginCta}
        </a>
        <a
          class="rounded-full border border-slate-200 bg-white px-7 py-3 text-center font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-pink-200 hover:text-pink-600"
          href="#ranking"
        >
          {ko.home.exploreCta}
        </a>
      </div>
    </div>

    <div class="rounded-[2rem] border border-white/70 bg-white/75 p-6 shadow-2xl shadow-slate-200 backdrop-blur">
      <div class="rounded-[1.5rem] bg-slate-950 p-5 text-white">
        <div class="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <p class="text-sm text-pink-200">{ko.home.dashboardEyebrow}</p>
            <p class="text-2xl font-bold">{ko.home.dashboardTitle}</p>
          </div>
          <span class="rounded-full bg-pink-500 px-3 py-1 text-sm font-semibold">{ko.home.betaBadge}</span>
        </div>
        <div class="mt-6 grid gap-4 sm:grid-cols-2">
          {#each highlights as item}
            <a id={item.id} class="block rounded-2xl bg-white/10 p-5 transition hover:bg-white/15" href={`#${item.id}`}>
              <p class="font-semibold text-white">{item.label}</p>
              <p class="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
            </a>
          {/each}
        </div>
      </div>
    </div>
  </div>
</section>
