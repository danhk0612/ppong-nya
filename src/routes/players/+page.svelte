<script lang="ts">
  import Card from "$lib/components/Card.svelte";
  import PlayerSearch from "$lib/components/PlayerSearch.svelte";
</script>

<svelte:head>
  <title>플레이어 검색 | 퐁냐</title>
  <meta
    name="description"
    content="닉네임 또는 플레이어 ID로 작혼 4인전 플레이어와 기간별 전적 통계를 검색합니다."
  />
</svelte:head>

<section class="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
  <p class="text-sm font-black text-brand-600">4인전 플레이어 검색</p>
  <h1 class="mt-3 text-4xl font-black tracking-tight text-ink-950 sm:text-5xl">
    누구의 전적을 찾아볼까요?
  </h1>
  <p class="mt-5 max-w-2xl text-base leading-8 text-ink-600">
    작혼 닉네임 또는 플레이어 ID를 입력하면 저장된 데이터를 우선 사용하고 필요한 전적을 추가로 갱신해 기간과 탁 종류별 통계를 보여줍니다.
  </p>

  <Card class="mt-8 overflow-visible" title="플레이어 검색">
    <PlayerSearch />
  </Card>
</section>
