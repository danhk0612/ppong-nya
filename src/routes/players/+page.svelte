<script lang="ts">
  import Card from "$lib/components/Card.svelte";
  import PlayerSearch from "$lib/components/PlayerSearch.svelte";
</script>

<svelte:head>
  <title>플레이어 검색 | 퐁냐</title>
  <meta
    name="description"
    content="닉네임 또는 플레이어 ID로 수집된 작혼 4인전 플레이어와 기간별 전적을 검색합니다."
  />
</svelte:head>

<section class="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
  <p class="text-sm font-black text-brand-600">4인전 플레이어 검색</p>
  <h1 class="mt-3 text-4xl font-black tracking-tight text-ink-950 sm:text-5xl">
    누구의 전적을 찾아볼까요?
  </h1>
  <p class="mt-5 max-w-2xl text-base leading-8 text-ink-600">
    직접 수집해 저장한 작혼 4인전 데이터를 기준으로 닉네임 또는 플레이어 ID를 검색하고, 기간과 탁 종류별 전적을 보여줍니다.
  </p>

  <Card class="mt-8 overflow-visible" title="플레이어 검색">
    <PlayerSearch />
  </Card>
</section>
