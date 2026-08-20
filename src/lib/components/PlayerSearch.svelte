<script lang="ts">
  import type { Session } from "@auth/sveltekit";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { syncFavoritePlayer } from "$lib/favoriteSync";
  import { searchPlayer, type PlayerSearchResult } from "../../data/source/misc";
  import { Level, LevelWithDelta } from "../../data/types/level";
  import { getAccountZone, getAccountZoneTag } from "../../data/types/zone";

  let {
    session = null,
  }: {
    session?: Session | null;
  } = $props();

  let query = $state("");
  let results = $state<PlayerSearchResult[]>([]);
  let favoritePlayerIds = $state(new Set<string>());
  let loading = $state(false);
  let savingPlayerId = $state("");
  let errorMessage = $state("");
  let actionMessage = $state("");
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

  async function loadFavorites() {
    if (!session?.user) return;

    const response = await fetch("/api/favorites");
    if (!response.ok) return;

    const payload = await response.json();
    favoritePlayerIds = new Set(
      payload.favorites.map((favorite: { playerId: string }) =>
        String(favorite.playerId),
      ),
    );
  }

  async function runSearch(value: string) {
    requestedQuery = value;
    loading = true;
    errorMessage = "";
    actionMessage = "";

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
        errorMessage =
          "플레이어 검색 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
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
      actionMessage = "";
      results = [];
      return;
    }

    loading = true;
    debounceToken = setTimeout(() => void runSearch(normalizedQuery), 500);
  }

  function openPlayer(player: PlayerSearchResult) {
    goto(`/player/${player.id}`);
  }

  function moveToLogin() {
    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.set("q", query.trim());
    const returnTo = returnUrl.pathname + returnUrl.search;
    goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  async function addFavorite(player: PlayerSearchResult) {
    if (!session?.user) {
      moveToLogin();
      return;
    }

    savingPlayerId = String(player.id);
    errorMessage = "";
    actionMessage = "";

    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          playerId: String(player.id),
          nickname: player.nickname.trim() || player.nickname,
          metadata: {
            level: player.level,
            latestTimestamp: player.latest_timestamp,
          },
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => undefined);
        throw new Error(payload?.message ?? "즐겨찾기에 추가하지 못했습니다.");
      }

      favoritePlayerIds = new Set([
        ...favoritePlayerIds,
        String(player.id),
      ]);
      actionMessage = `${player.nickname.trim() || player.nickname} 플레이어의 전적을 가져오는 중입니다.`;

      try {
        await syncFavoritePlayer(String(player.id));
        actionMessage = `${player.nickname.trim() || player.nickname} 플레이어의 전적을 저장했습니다.`;
      } catch {
        actionMessage =
          "즐겨찾기에 추가했습니다. 전적은 플레이어 화면을 열 때 다시 가져옵니다.";
      }
    } catch (error) {
      errorMessage =
        error instanceof Error
          ? error.message
          : "즐겨찾기에 추가하지 못했습니다.";
    } finally {
      savingPlayerId = "";
    }
  }

  onMount(() => {
    void loadFavorites();

    const initialQuery = new URL(window.location.href).searchParams.get("q");
    if (initialQuery?.trim()) {
      query = initialQuery;
      void runSearch(normalizedName(initialQuery));
    }
  });
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
    <span
      class="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-xl text-brand-500"
      aria-hidden="true"
    >
      {loading ? "…" : "⌕"}
    </span>
  </div>
  <p id="player-search-help" class="mt-2 px-1 text-xs leading-5 text-ink-500">
    퐁냐에 수집된 4인전 플레이어를 닉네임 앞부분으로 검색합니다.
  </p>

  {#if actionMessage}
    <p class="mt-2 px-1 text-sm font-bold text-brand-700">{actionMessage}</p>
  {/if}

  {#if query.trim()}
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
          {@const registered = favoritePlayerIds.has(String(player.id))}
          <article
            class="flex items-center gap-2 rounded-2xl px-2 py-2 transition hover:bg-brand-50"
            class:opacity-50={isOlderDuplicate(player)}
          >
            <button
              class="min-w-0 flex-1 px-2 py-1 text-left focus-visible:outline-none"
              type="button"
              aria-label={`${player.nickname.trim()} ${LevelWithDelta.getTag(player.level)} 전적 보기`}
              onclick={() => openPlayer(player)}
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
            <button
              class="min-h-9 shrink-0 rounded-2xl px-3 text-xs font-black transition"
              class:bg-brand-50={registered}
              class:text-brand-700={registered}
              class:bg-brand-500={!registered}
              class:text-white={!registered}
              type="button"
              disabled={registered || savingPlayerId === String(player.id)}
              onclick={() => void addFavorite(player)}
            >
              {registered
                ? "즐겨찾기 등록됨"
                : savingPlayerId === String(player.id)
                  ? "추가 중..."
                  : "즐겨찾기 추가"}
            </button>
          </article>
        {/each}
      {/if}
    </div>
  {/if}
</div>
