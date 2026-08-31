<script lang="ts">
  import Card from "$lib/components/Card.svelte";
  import PlayerSearch from "$lib/components/PlayerSearch.svelte";
  import { ko } from "$lib/i18n";
</script>

<section class="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
  <div class="text-center">
    <span class="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-brand-500 text-2xl font-black text-white shadow-brand" aria-hidden="true">
      {ko.app.logoKana}
    </span>
    <p class="mt-6 text-sm font-black text-brand-600">{ko.home.eyebrow}</p>
    <h1 class="mx-auto mt-3 max-w-3xl font-display text-4xl font-black tracking-tight text-ink-950 sm:text-5xl">
      {ko.home.title}
    </h1>
    <p class="mx-auto mt-5 max-w-2xl text-base leading-8 text-ink-600 sm:text-lg">
      작혼 4인전 플레이어를 검색하고 원하는 기간과 탁을 선택해 전적과 통계를 확인합니다.
    </p>
  </div>

  <Card class="mt-10 overflow-visible" title="플레이어 검색" eyebrow="4인전">
    <PlayerSearch />
  </Card>
</section>
