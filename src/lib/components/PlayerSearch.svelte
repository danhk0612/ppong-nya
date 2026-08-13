<script lang="ts">
  import { goto } from "$app/navigation";
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
    loading = true;
    errorMessage = "";

    try {
      const players = (await searchPlayer(value, 20)).filter(
        (player) => new Level(player.level.id).getNumPlayerId() === 1,
      );
      if (requestedQuery === value) {
        results = players;
      }
    } catch {
      if (requestedQuery === value) {
        results = [];
        errorMessage = "플레이어 검색 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
      }
    } finally {
      if (requestedQuery === value) {
        loading = false;
      }
    }
  }

  function handleInput(event: Event) {
    query = (event.currentTarget as HTMLInputElement).value;
    const normalizedQuery = normalizedName(query);

    if (debounceToken) {
      clearTimeout(debounceToken);
    }

    if (!normalizedQuery) {
      requestedQuery = "";
      loading = false;
      errorMessage = "";
      results = [];
      return;
    }

    loading = true;
    debounceToken = setTimeout(() => runSearch(normalizedQuery), 500);
  }

  function openPlayer(player: PlayerSearchResult) {
    goto(`/player/${player.id}`);
  }
</script>

<div class="relative">
  <label class="sr-only" for="player-search-input">작혼 플레이어 닉네임</label>
  <div class="relative">
    <input
      id="player-search-input"
      class="min-h-14 w-full rounded-3xl border border-brand-100 bg-white px-5 py-4 pr-14 text-base font-bold text-ink-950 shadow-soft outline-none transition placeholder:font-medium placeholder:text-ink-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
      type="search"
      placeholder="작혼 닉네임을 입력하세요"
      value={query}
      oninput={handleInput}
      autocomplete="off"
      spellcheck="false"
      aria-describedby="player-search-help"
      aria-controls="player-search-results"
    />
    <span class="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-xl text-brand-500" aria-hidden="true">
      {loading ? "…" : "⌕"}
    </span>
  </div>
  <p id="player-search-help" class="mt-2 px-1 text-xs leading-5 text-ink-500">
    퐁냐에 수집된 4인전 플레이어를 닉네임 앞부분으로 검색합니다.
  </p>

  {#if query.trim()}
    <div id="player-search-results" class="absolute z-30 mt-2 max-h-96 w-full overflow-y-auto rounded-3xl border border-ink-100 bg-white p-2 shadow-xl">
      {#if loading && !results.length}
        <p class="px-4 py-5 text-center text-sm font-bold text-ink-500">검색 중...</p>
      {:else if errorMessage}
        <p class="px-4 py-5 text-center text-sm font-bold text-rose-600">{errorMessage}</p>
      {:else if !results.length}
        <p class="px-4 py-5 text-center text-sm font-bold text-ink-500">일치하는 4인전 플레이어가 없습니다.</p>
      {:else}
        {#each results as player (player.id)}
          <button
            class="flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left transition hover:bg-brand-50 focus-visible:bg-brand-50 focus-visible:outline-none"
            class:opacity-50={isOlderDuplicate(player)}
            type="button"
            aria-label={`${player.nickname.trim()} ${LevelWithDelta.getTag(player.level)}`}
            onclick={() => openPlayer(player)}
          >
            <span class="min-w-0">
              <span class:line-through={isOlderDuplicate(player)} class="block truncate font-black text-ink-950">{player.nickname.trim() || player.nickname}</span>
              <span class="mt-1 block text-xs text-ink-500">ID {player.id} · {getAccountZoneTag(player.id) || "서버 미상"}</span>
            </span>
            <span class="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-sm font-black text-brand-700">{LevelWithDelta.getTag(player.level)}</span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>
