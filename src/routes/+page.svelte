<script lang="ts">
  import { onMount } from "svelte";
  import Button from "$lib/components/Button.svelte";
  import Card from "$lib/components/Card.svelte";
  import { syncFavoritePlayer } from "$lib/favoriteSync";
  import PlayerSearch from "$lib/components/PlayerSearch.svelte";
  import { ko } from "$lib/i18n";

  let { data } = $props();

  onMount(async () => {
    if (!data.session?.user) return;

    for (const favorite of data.favorites) {
      await syncFavoritePlayer(favorite.playerId).catch(() => undefined);
    }
  });
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
      {ko.home.description}
    </p>
  </div>

  <Card class="mt-10 overflow-visible" title="플레이어 검색" eyebrow="4인전">
    <PlayerSearch />
  </Card>

  {#if data.session?.user}
    <section class="mt-10" aria-labelledby="favorite-heading">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm font-black text-brand-600">내 플레이어</p>
          <h2 id="favorite-heading" class="mt-2 text-2xl font-black text-ink-950">즐겨찾기 플레이어</h2>
        </div>
        <Button href="/account" variant="secondary" size="sm">전체 보기</Button>
      </div>

      {#if data.favorites.length}
        <div class="mt-5 grid gap-3 sm:grid-cols-2">
          {#each data.favorites as favorite (favorite.id)}
            <a class="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-brand-200" href={`/player/${favorite.playerId}`}>
              <p class="truncate text-lg font-black text-ink-950">{favorite.nickname}</p>
              <p class="mt-2 text-sm text-ink-500">플레이어 ID {favorite.playerId}</p>
              <p class="mt-4 text-sm font-black text-brand-700">전적 보기 →</p>
            </a>
          {/each}
        </div>
      {:else}
        <Card class="mt-5 text-center">
          <p class="font-black text-ink-950">등록된 즐겨찾기가 없습니다</p>
          <p class="mt-2 text-sm leading-6 text-ink-500">플레이어를 검색한 뒤 즐겨찾기에 추가할 수 있습니다.</p>
        </Card>
      {/if}
    </section>
  {:else}
    <Card class="mt-10 text-center" title="즐겨찾기로 편하게 확인하세요">
      <p class="text-sm leading-6 text-ink-600">로그인하면 자주 보는 플레이어를 저장하고 전적과 통계를 한곳에서 확인할 수 있습니다.</p>
      <Button class="mt-5" href="/login">{ko.home.loginCta}</Button>
    </Card>
  {/if}
</section>
