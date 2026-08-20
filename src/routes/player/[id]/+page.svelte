<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import Button from "$lib/components/Button.svelte";
  import Card from "$lib/components/Card.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import StatusBlock from "$lib/components/StatusBlock.svelte";
  import SummaryTile from "$lib/components/SummaryTile.svelte";
  import Table from "$lib/components/Table.svelte";
  import {
    getFavoriteSyncState,
    syncFavoritePlayer,
    type FavoriteSyncState,
  } from "$lib/favoriteSync";
  import { formatNumber } from "$lib/i18n/format";
  import { apiGet } from "../../../data/source/api";
  import { GameMode, modeLabel } from "../../../data/types/gameMode";
  import type {
    PlayerExtendedStats,
    PlayerMetadata,
  } from "../../../data/types/metadata";
  import { LevelWithDelta } from "../../../data/types/level";
  import {
    GameRecord,
    type GameRecord as GameRecordType,
  } from "../../../data/types/record";

  let { data } = $props();

  const ALL_MODES = [
    GameMode.王座,
    GameMode.玉,
    GameMode.金,
    GameMode.王东,
    GameMode.玉东,
    GameMode.金东,
  ];

  let metadata = $state<PlayerMetadata | null>(null);
  let extendedStats = $state<PlayerExtendedStats | null>(null);
  let records = $state<GameRecordType[]>([]);
  let loading = $state(true);
  let errorMessage = $state("");
  let favoriteId = $state("");
  let favoriteActionLoading = $state(false);
  let favoriteMessage = $state("");

  const percent = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value)
      ? new Intl.NumberFormat("ko-KR", {
          style: "percent",
          maximumFractionDigits: 2,
        }).format(value)
      : "-";

  const decimal = (value: number | null | undefined, digits = 2) =>
    typeof value === "number" && Number.isFinite(value)
      ? new Intl.NumberFormat("ko-KR", {
          maximumFractionDigits: digits,
        }).format(value)
      : "-";

  function applySyncState(state: FavoriteSyncState) {
    metadata = state.metadata;
    extendedStats = state.extendedStats;
    records = state.records;
  }

  function getErrorMessage(reason: unknown) {
    if (reason && typeof reason === "object" && "status" in reason) {
      const status = Number((reason as { status: unknown }).status);
      if (status === 404) return "플레이어 정보를 찾지 못했습니다.";
      if (status === 429)
        return "데이터 서버의 사람 확인을 완료하지 못했습니다. 다시 시도해 주세요.";
    }
    return reason instanceof Error
      ? reason.message
      : "플레이어 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  async function findFavorite() {
    if (!data.session?.user) return "";

    const response = await fetch("/api/favorites");
    if (!response.ok) return "";

    const payload = await response.json();
    return (
      payload.favorites.find(
        (favorite: { playerId: string }) =>
          String(favorite.playerId) === data.playerId,
      )?.id ?? ""
    );
  }

  async function loadBasicPlayer() {
    const startMillis = new Date("2010-01-01T00:00:00.000").getTime();
    const endMillis = Date.now();
    const mode = ALL_MODES.join(".");
    const hourTag = Math.floor(Date.now() / 3_600_000);
    metadata = await apiGet<PlayerMetadata>(
      `player_stats/${data.playerId}/${startMillis}/${endMillis}?mode=${mode}&tag=${hourTag}`,
    );
    extendedStats = null;
    records = [];
  }

  async function loadManagedPlayer() {
    try {
      applySyncState(await syncFavoritePlayer(data.playerId));
    } catch (reason) {
      const savedState = await getFavoriteSyncState(data.playerId).catch(
        () => null,
      );

      if (!savedState?.metadata) throw reason;

      applySyncState(savedState);
      favoriteMessage =
        "새 전적을 가져오지 못해 마지막으로 저장된 정보를 표시합니다.";
    }
  }

  async function initialize() {
    loading = true;
    errorMessage = "";

    try {
      favoriteId = await findFavorite();
      if (favoriteId) {
        await loadManagedPlayer();
      } else {
        await loadBasicPlayer();
      }
    } catch (reason) {
      errorMessage = getErrorMessage(reason);
    } finally {
      loading = false;
    }
  }

  function moveToLogin() {
    const returnTo = window.location.pathname + window.location.search;
    goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  async function addFavorite() {
    if (!data.session?.user) {
      moveToLogin();
      return;
    }

    if (!metadata) return;

    favoriteActionLoading = true;
    favoriteMessage = "즐겨찾기에 추가하고 전적을 가져오는 중입니다.";

    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          playerId: data.playerId,
          nickname: metadata.nickname.trim() || metadata.nickname,
          metadata: {
            level: metadata.level,
            maxLevel: metadata.max_level,
          },
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => undefined);
        throw new Error(payload?.message ?? "즐겨찾기에 추가하지 못했습니다.");
      }

      const payload = await response.json();
      favoriteId = payload.favorite.id;
      await loadManagedPlayer();
      favoriteMessage = "즐겨찾기와 최근 전적을 저장했습니다.";
    } catch (error) {
      favoriteMessage =
        error instanceof Error
          ? error.message
          : "즐겨찾기에 추가하지 못했습니다.";
    } finally {
      favoriteActionLoading = false;
    }
  }

  async function removeFavorite() {
    if (!favoriteId) return;

    favoriteActionLoading = true;
    favoriteMessage = "";

    try {
      const response = await fetch("/api/favorites", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: favoriteId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => undefined);
        throw new Error(payload?.message ?? "즐겨찾기를 삭제하지 못했습니다.");
      }

      favoriteId = "";
      extendedStats = null;
      records = [];
      favoriteMessage =
        "즐겨찾기에서 삭제했습니다. 기존 수집 전적은 보존됩니다.";
    } catch (error) {
      favoriteMessage =
        error instanceof Error
          ? error.message
          : "즐겨찾기를 삭제하지 못했습니다.";
    } finally {
      favoriteActionLoading = false;
    }
  }

  function playerFromRecord(record: GameRecordType) {
    return record.players.find(
      (player) => String(player.accountId) === data.playerId,
    );
  }

  onMount(() => {
    void initialize();
  });
</script>

<svelte:head>
  <title>{metadata?.nickname?.trim() || "플레이어"} | 퐁냐</title>
  <meta
    name="description"
    content="작혼 4인전 플레이어의 등급과 즐겨찾기 전적 통계를 확인합니다."
  />
</svelte:head>

<section class="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
  <PageHeader
    eyebrow="4인전 플레이어"
    title={metadata?.nickname?.trim() || `플레이어 ${data.playerId}`}
    description={`플레이어 ID ${data.playerId}`}
  >
    {#snippet actions()}
      <Button href="/players" variant="secondary">다른 플레이어 검색</Button>
      {#if favoriteId}
        <Button
          variant="danger"
          disabled={favoriteActionLoading}
          onclick={() => void removeFavorite()}
        >
          {favoriteActionLoading ? "처리 중..." : "즐겨찾기 삭제"}
        </Button>
      {:else}
        <Button
          disabled={favoriteActionLoading || Boolean(data.session?.user && !metadata)}
          onclick={() => void addFavorite()}
        >
          {favoriteActionLoading ? "처리 중..." : "즐겨찾기 추가"}
        </Button>
      {/if}
    {/snippet}
  </PageHeader>

  {#if favoriteMessage}
    <p class="mt-4 text-sm font-bold text-brand-700">{favoriteMessage}</p>
  {/if}

  {#if loading}
    <StatusBlock
      class="mt-8"
      tone="loading"
      title="플레이어 정보를 불러오는 중입니다"
    />
  {:else if errorMessage}
    <StatusBlock
      class="mt-8"
      tone="error"
      title="플레이어 정보를 표시할 수 없습니다"
      description={errorMessage}
      actionLabel="검색으로 돌아가기"
      actionHref="/players"
    />
  {:else if metadata}
    {#if !favoriteId}
      <Card class="mt-8" title="플레이어 기본 정보">
        <div class="grid gap-3 sm:grid-cols-2">
          <SummaryTile
            label="현재 등급"
            value={LevelWithDelta.format(metadata.level)}
          />
          <SummaryTile label="플레이어 ID" value={data.playerId} />
        </div>
        <p class="mt-5 text-sm leading-6 text-ink-600">
          즐겨찾기에 추가하면 통계와 최근 전적을 자동으로 저장하고 관리합니다.
        </p>
      </Card>
    {:else}
      <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile
          label="현재 등급"
          value={LevelWithDelta.format(metadata.level)}
        />
        <SummaryTile
          label="최고 등급"
          value={LevelWithDelta.format(metadata.max_level)}
        />
        <SummaryTile
          label="기록 대국"
          value={`${formatNumber(metadata.count)}전`}
        />
        <SummaryTile
          label="평균 순위"
          value={decimal(metadata.avg_rank, 3)}
        />
      </div>

      <div class="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="순위 분포">
          <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {#each metadata.rank_rates as rate, index}
              <SummaryTile label={`${index + 1}위율`} value={percent(rate)} />
            {/each}
          </dl>
        </Card>

        <Card title="핵심 지표">
          {#if extendedStats}
            <dl class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <SummaryTile label="화료율" value={percent(extendedStats.和牌率)} />
              <SummaryTile label="방총률" value={percent(extendedStats.放铳率)} />
              <SummaryTile label="리치율" value={percent(extendedStats.立直率)} />
              <SummaryTile label="부로율" value={percent(extendedStats.副露率)} />
              <SummaryTile
                label="평균 타점"
                value={formatNumber(extendedStats.平均打点)}
              />
              <SummaryTile
                label="평균 방총점"
                value={formatNumber(extendedStats.平均铳点)}
              />
            </dl>
          {:else}
            <StatusBlock title="저장된 상세 통계가 없습니다" />
          {/if}
        </Card>
      </div>

      <div class="mt-8">
        <p class="text-sm font-black text-brand-600">최근 대국</p>
        <h2 class="mt-2 text-2xl font-black text-ink-950">최근 30전</h2>
      </div>

      {#if !records.length}
        <StatusBlock class="mt-5" title="저장된 최근 대국이 없습니다" />
      {:else}
        <Table
          class="mt-5"
          caption="플레이어 최근 대국"
          headers={["일시", "탁", "순위", "점수", "상대", "대국"]}
        >
          {#each records as record (record.uuid)}
            {@const player = playerFromRecord(record)}
            <tr>
              <td class="whitespace-nowrap px-4 py-4">
                {GameRecord.formatFullStartTime(record)}
              </td>
              <td class="whitespace-nowrap px-4 py-4 font-bold">
                {modeLabel(record.modeId)}
              </td>
              <td
                class="whitespace-nowrap px-4 py-4 font-black text-brand-700"
              >
                {player ? GameRecord.getPlayerRankLabel(record, player) : "-"}
              </td>
              <td class="whitespace-nowrap px-4 py-4">
                {player ? formatNumber(player.score) : "-"}
              </td>
              <td class="min-w-56 px-4 py-4 text-xs leading-5">
                {record.players
                  .filter(
                    (item) => String(item.accountId) !== data.playerId,
                  )
                  .map((item) => item.nickname.trim())
                  .join(" · ")}
              </td>
              <td class="whitespace-nowrap px-4 py-4">
                <a
                  class="font-black text-brand-700 hover:underline"
                  href={GameRecord.getRecordLink(record, data.playerId)}
                  target="_blank"
                  rel="noreferrer"
                >
                  작혼에서 보기
                </a>
              </td>
            </tr>
          {/each}
        </Table>
      {/if}
    {/if}
  {/if}
</section>
