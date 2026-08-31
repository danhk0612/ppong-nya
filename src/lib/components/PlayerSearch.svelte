<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { searchPlayer, type PlayerSearchResult } from "../../data/source/misc";
  import { Level, LevelWithDelta } from "../../data/types/level";
  import { getAccountZone, getAccountZoneTag } from "../../data/types/zone";

  let query = $state("");
  let results = $state<PlayerSearchResult[]>([]);
  let loading = $state(false);
  let errorMessage = $state("");
  let requestedQuery = "";
  let debounceToken: ReturnType<typeof setTimeout> | undefined;

  function normalizedName(value: string) {
    return value.toLocaleLowerCase().trim();
  }

  function isOlderDuplicate(player: PlayerSearchResult) {
    return results.some(
      (candidate) =>
        candidate.id !== player.id &&
        candidate.nickname === player.nickname &&
        getAccountZone(candidate.id) === getAccountZone(player.id) &&
        candidate.latest_timestamp > player.latest_timestamp,
    );
  }

  async function runSearch(value: string) {
    requestedQuery = value;
    errorMessage = "";

    if (/^\d+$/.test(value)) {
      results = [];
      loading = false;
      return;
    }

    loading = true;
    try {
      const players = (await searchPlayer(value, 20)).filter(
        (player) => new Level(player.level.id).getNumPlayerId() === 1,
      );
      if (requestedQuery === value) results = players;
    } catch {
      if (requestedQuery === value) {
        results = [];
        errorMessage =
          "플레이어 검색 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
      }
    } finally {
      if (requestedQuery === value) loading = false;
    }
  }

  function handleInput(event: Event) {
    query = (event.currentTarget as HTMLInputElement).value;
    const normalizedQuery = normalizedName(query);

    if (debounceToken) clearTimeout(debounceToken);

    if (!normalizedQuery) {
      requestedQuery = "";
      loading = false;
      errorMessage = "";
      results = [];
      return;
    }

    loading = true;
    debounceToken = setTimeout(() => void runSearch(normalizedQuery), 500);
  }

  async function openPlayer(player: PlayerSearchResult) {
    try {
      await fetch(`/api/players/${player.id}/seed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname: player.nickname.trim() || player.nickname,
          level: player.level.id,
          latestTimestamp: player.latest_timestamp,
        }),
      });
    } catch {
      // Navigation should still continue. The detail API can retry upstream itself.
    }

    await goto(`/player/${player.id}`);
  }

  function openDirect() {
    const value = query.trim();
    if (!value) return;
    goto(`/player/${encodeURIComponent(value)}`);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      openDirect();
    }
  }

  onMount(() => {
    const initialQuery = new URL(window.location.href).searchParams.get("q");
    if (initialQuery?.trim()) {
      query = initialQuery;
      void runSearch(normalizedName(initialQuery));
    }
  });
</script>

<div class="relative">
  <label class="sr-only" for="player-search-input">작혼 플레이어 이름 또는 ID</label>
  <div class="flex gap-2">
    <div class="relative min-w-0 flex-1">
      <input
        id="player-search-input"
        class="min-h-14 w-full rounded-3xl border border-brand-100 bg-white px-5 py-4 pr-14 text-base font-bold text-ink-950 shadow-soft outline-none transition placeholder:font-medium placeholder:text-ink-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
        type="search"
        placeholder="작혼 닉네임 또는 플레이어 ID"
        value={query}
        oninput={handleInput}
        onkeydown={handleKeydown}
        autocomplete="off"
        spellcheck="false"
        aria-describedby="player-search-help"
        aria-controls="player-search-results"
      />
      <span
        class="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-xl text-brand-500"
        aria-hidden="true"
      >
        {loading ? "…" : "⌕"}
      </span>
    </div>
    <button
      class="min-h-14 shrink-0 rounded-3xl bg-brand-500 px-5 text-sm font-black text-white shadow-brand transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
      type="button"
      disabled={!query.trim()}
      onclick={openDirect}
    >
      검색
    </button>
  </div>

  <p id="player-search-help" class="mt-2 px-1 text-xs leading-5 text-ink-500">
    닉네임으로 검색하거나 플레이어 ID를 직접 입력할 수 있습니다.
  </p>

  {#if query.trim() && !/^\d+$/.test(query.trim())}
    <div
      id="player-search-results"
      class="absolute z-30 mt-2 max-h-96 w-full overflow-y-auto rounded-3xl border border-ink-100 bg-white p-2 shadow-xl"
    >
      {#if loading && !results.length}
        <p class="px-4 py-5 text-center text-sm font-bold text-ink-500">
          검색 중...
        </p>
      {:else if errorMessage}
        <p class="px-4 py-5 text-center text-sm font-bold text-rose-600">
          {errorMessage}
        </p>
      {:else if !results.length}
        <p class="px-4 py-5 text-center text-sm font-bold text-ink-500">
          일치하는 4인전 플레이어가 없습니다.
        </p>
      {:else}
        {#each results as player (player.id)}
          <button
            class="block w-full rounded-2xl px-4 py-3 text-left transition hover:bg-brand-50 focus-visible:outline-none"
            class:opacity-50={isOlderDuplicate(player)}
            type="button"
            aria-label={`${player.nickname.trim()} ${LevelWithDelta.getTag(player.level)} 전적 보기`}
            onclick={() => void openPlayer(player)}
          >
            <span
              class:line-through={isOlderDuplicate(player)}
              class="block truncate font-black text-ink-950"
            >
              {player.nickname.trim() || player.nickname}
            </span>
            <span class="mt-1 block text-xs text-ink-500">
              ID {player.id} · {getAccountZoneTag(player.id) || "서버 미상"} ·
              {LevelWithDelta.getTag(player.level)}
            </span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>
