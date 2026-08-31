<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import Button from "$lib/components/Button.svelte";
  import Card from "$lib/components/Card.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import StatusBlock from "$lib/components/StatusBlock.svelte";
  import SummaryTile from "$lib/components/SummaryTile.svelte";
  import Table from "$lib/components/Table.svelte";
  import { formatNumber } from "$lib/i18n/format";
  import { modeLabel } from "../../../data/types/gameMode";
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

  const MODE_OPTIONS = [
    { value: "all", label: "전체" },
    { value: "16", label: "왕좌탁" },
    { value: "12", label: "옥탁" },
    { value: "8", label: "금탁" },
    { value: "15", label: "왕좌탁 동풍전" },
    { value: "11", label: "옥탁 동풍전" },
    { value: "9", label: "금탁 동풍전" },
  ];

  const PERIOD_OPTIONS = [
    { value: "7", label: "최근 7일" },
    { value: "30", label: "최근 30일" },
    { value: "90", label: "최근 90일" },
    { value: "180", label: "최근 6개월" },
    { value: "365", label: "최근 1년" },
    { value: "custom", label: "직접 지정" },
  ];

  type ApiPlayer = {
    playerId: string;
    nickname: string;
    lastUpdatedAt: string | null;
  };

  type ApiPayload = {
    player: ApiPlayer;
    records: GameRecordType[];
    statistics: {
      metadata: PlayerMetadata | null;
      extendedStats: PlayerExtendedStats | null;
    };
  };

  let player = $state<ApiPlayer | null>(null);
  let metadata = $state<PlayerMetadata | null>(null);
  let extendedStats = $state<PlayerExtendedStats | null>(null);
  let records = $state<GameRecordType[]>([]);
  let loading = $state(true);
  let refreshing = $state(false);
  let errorMessage = $state("");
  let periodPreset = $state("30");
  let startDate = $state("");
  let endDate = $state("");
  let selectedMode = $state("all");

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

  function formatDateInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function applyPreset(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    startDate = formatDateInput(start);
    endDate = formatDateInput(end);
  }

  function applyInitialQuery() {
    const url = new URL(window.location.href);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const mode = url.searchParams.get("mode");

    if (from && to) {
      const parsedFrom = new Date(from);
      const parsedTo = new Date(to);
      if (!Number.isNaN(parsedFrom.getTime()) && !Number.isNaN(parsedTo.getTime())) {
        startDate = formatDateInput(parsedFrom);
        endDate = formatDateInput(parsedTo);
        periodPreset = "custom";
      }
    }

    if (!startDate || !endDate) applyPreset(30);
    if (mode && MODE_OPTIONS.some((option) => option.value === mode)) {
      selectedMode = mode;
    }
  }

  function buildQuery() {
    const from = new Date(`${startDate}T00:00:00`);
    const to = new Date(`${endDate}T23:59:59.999`);
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      mode: selectedMode,
    });
    return params;
  }

  function applyPayload(payload: ApiPayload) {
    player = payload.player;
    metadata = payload.statistics.metadata;
    extendedStats = payload.statistics.extendedStats;
    records = payload.records;
  }

  async function loadData(force = false) {
    errorMessage = "";
    if (force) refreshing = true;
    else loading = true;

    try {
      const params = buildQuery();
      const response = await fetch(`/api/players/${data.playerId}?${params.toString()}`, {
        method: force ? "POST" : "GET",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message ?? "플레이어 데이터를 불러오지 못했습니다.");
      }
      applyPayload(payload as ApiPayload);
    } catch (reason) {
      errorMessage =
        reason instanceof Error
          ? reason.message
          : "플레이어 데이터를 불러오지 못했습니다.";
    } finally {
      loading = false;
      refreshing = false;
    }
  }

  async function applyFilters() {
    const params = buildQuery();
    await goto(`/player/${data.playerId}?${params.toString()}`, {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    });
    await loadData(false);
  }

  async function changePreset(event: Event) {
    periodPreset = (event.currentTarget as HTMLSelectElement).value;
    if (periodPreset !== "custom") {
      applyPreset(Number(periodPreset));
      await applyFilters();
    }
  }

  async function changeMode(event: Event) {
    selectedMode = (event.currentTarget as HTMLSelectElement).value;
    await applyFilters();
  }

  function playerFromRecord(record: GameRecordType) {
    return record.players.find(
      (recordPlayer) => String(recordPlayer.accountId) === data.playerId,
    );
  }

  function formatUpdatedAt(value: string | null | undefined) {
    if (!value) return "아직 갱신되지 않음";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  onMount(() => {
    applyInitialQuery();
    void loadData(false);
  });
</script>

<svelte:head>
  <title>{player?.nickname?.trim() || "플레이어"} | 퐁냐</title>
  <meta
    name="description"
    content="작혼 4인전 플레이어의 기간별·탁별 전적과 통계를 확인합니다."
  />
</svelte:head>

<section class="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
  <PageHeader
    eyebrow="4인전 플레이어"
    title={player?.nickname?.trim() || `플레이어 ${data.playerId}`}
    description={`플레이어 ID ${data.playerId}`}
  >
    {#snippet actions()}
      <Button href="/players" variant="secondary">다른 플레이어 검색</Button>
      <Button disabled={refreshing} onclick={() => void loadData(true)}>
        {refreshing ? "갱신 중..." : "새로고침"}
      </Button>
    {/snippet}
  </PageHeader>

  <p class="mt-4 text-sm text-ink-500">
    마지막 업데이트: {formatUpdatedAt(player?.lastUpdatedAt)}
  </p>

  <Card class="mt-8" title="조회 조건">
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label class="text-sm font-bold text-ink-700">
        기간
        <select
          class="mt-2 min-h-11 w-full rounded-2xl border border-ink-200 bg-white px-3 font-bold text-ink-950"
          value={periodPreset}
          onchange={(event) => void changePreset(event)}
        >
          {#each PERIOD_OPTIONS as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>

      <label class="text-sm font-bold text-ink-700">
        시작일
        <input
          class="mt-2 min-h-11 w-full rounded-2xl border border-ink-200 bg-white px-3 font-bold text-ink-950"
          type="date"
          bind:value={startDate}
          onchange={() => (periodPreset = "custom")}
        />
      </label>

      <label class="text-sm font-bold text-ink-700">
        종료일
        <input
          class="mt-2 min-h-11 w-full rounded-2xl border border-ink-200 bg-white px-3 font-bold text-ink-950"
          type="date"
          bind:value={endDate}
          onchange={() => (periodPreset = "custom")}
        />
      </label>

      <label class="text-sm font-bold text-ink-700">
        탁 종류
        <select
          class="mt-2 min-h-11 w-full rounded-2xl border border-ink-200 bg-white px-3 font-bold text-ink-950"
          value={selectedMode}
          onchange={(event) => void changeMode(event)}
        >
          {#each MODE_OPTIONS as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
    </div>

    <div class="mt-4 flex justify-end">
      <Button onclick={() => void applyFilters()}>조회</Button>
    </div>
  </Card>

  {#if loading}
    <StatusBlock
      class="mt-8"
      tone="loading"
      title="플레이어 데이터를 불러오는 중입니다"
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
        label="조회 대국"
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
          <StatusBlock title="선택한 조건의 상세 통계가 없습니다" />
        {/if}
      </Card>
    </div>
  {/if}

  <div class="mt-8">
    <p class="text-sm font-black text-brand-600">대국 기록</p>
    <h2 class="mt-2 text-2xl font-black text-ink-950">
      선택한 기간의 대국 {records.length}전
    </h2>
  </div>

  {#if !loading && !records.length && !errorMessage}
    <StatusBlock class="mt-5" title="선택한 조건의 대국이 없습니다" />
  {:else if records.length}
    <Table
      class="mt-5"
      caption="플레이어 기간별 대국"
      headers={["일시", "탁", "순위", "점수", "상대", "대국"]}
    >
      {#each records as record (record.uuid)}
        {@const recordPlayer = playerFromRecord(record)}
        <tr>
          <td class="whitespace-nowrap px-4 py-4">
            {GameRecord.formatFullStartTime(record)}
          </td>
          <td class="whitespace-nowrap px-4 py-4 font-bold">
            {modeLabel(record.modeId)}
          </td>
          <td class="whitespace-nowrap px-4 py-4 font-black text-brand-700">
            {recordPlayer ? GameRecord.getPlayerRankLabel(record, recordPlayer) : "-"}
          </td>
          <td class="whitespace-nowrap px-4 py-4">
            {recordPlayer ? formatNumber(recordPlayer.score) : "-"}
          </td>
          <td class="min-w-56 px-4 py-4 text-xs leading-5">
            {record.players
              .filter((item) => String(item.accountId) !== data.playerId)
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
</section>