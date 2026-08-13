<script lang="ts">
  import { onMount } from "svelte";
  import Button from "$lib/components/Button.svelte";
  import Card from "$lib/components/Card.svelte";
  import Input from "$lib/components/Input.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import Select from "$lib/components/Select.svelte";
  import StatusBlock from "$lib/components/StatusBlock.svelte";
  import SummaryTile from "$lib/components/SummaryTile.svelte";
  import Table from "$lib/components/Table.svelte";
  import { formatNumber } from "$lib/i18n/format";
  import { apiGet } from "../../../data/source/api";
  import { GameMode, modeLabel } from "../../../data/types/gameMode";
  import type { PlayerExtendedStats, PlayerMetadata } from "../../../data/types/metadata";
  import { LevelWithDelta } from "../../../data/types/level";
  import { GameRecord, type GameRecord as GameRecordType } from "../../../data/types/record";

  let { data }: { data: { playerId: string } } = $props();

  const ALL_MODES = [GameMode.王座, GameMode.玉, GameMode.金, GameMode.王东, GameMode.玉东, GameMode.金东];
  const allModesValue = ALL_MODES.join(".");

  let selectedMode = $state(allModesValue);
  let startDate = $state("2010-01-01");
  let endDate = $state(new Date().toISOString().slice(0, 10));
  let metadata = $state<PlayerMetadata | null>(null);
  let extendedStats = $state<PlayerExtendedStats | null>(null);
  let records = $state<GameRecordType[]>([]);
  let loading = $state(true);
  let recordsLoading = $state(false);
  let errorMessage = $state("");
  let recordsError = $state("");
  let requestVersion = 0;

  const percent = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value)
      ? new Intl.NumberFormat("ko-KR", { style: "percent", maximumFractionDigits: 2 }).format(value)
      : "-";

  const decimal = (value: number | null | undefined, digits = 2) =>
    typeof value === "number" && Number.isFinite(value)
      ? new Intl.NumberFormat("ko-KR", { maximumFractionDigits: digits }).format(value)
      : "-";

  function dateToMillis(value: string, endOfDay = false) {
    const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
    return new Date(`${value}${suffix}`).getTime();
  }

  function getErrorMessage(reason: unknown) {
    if (reason && typeof reason === "object" && "status" in reason) {
      const status = Number((reason as { status: unknown }).status);
      if (status === 404) return "해당 조건의 플레이어 전적을 찾지 못했습니다.";
      if (status === 429) return "데이터 서버의 사람 확인을 완료하지 못했습니다. 다시 시도해 주세요.";
    }
    return "플레이어 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  async function loadRecords(version: number, startMillis: number, endMillis: number) {
    recordsLoading = true;
    recordsError = "";

    try {
      const result = await apiGet<GameRecordType[]>(
        `player_records/${data.playerId}/${endMillis}/${startMillis}?limit=30&mode=${selectedMode}&descending=true&tag=${metadata?.count ?? ""}`,
      );
      if (version === requestVersion) records = result;
    } catch (reason) {
      if (version === requestVersion) {
        records = [];
        recordsError = getErrorMessage(reason);
      }
    } finally {
      if (version === requestVersion) recordsLoading = false;
    }
  }

  async function loadPlayer() {
    const version = ++requestVersion;
    const startMillis = dateToMillis(startDate);
    const endMillis = dateToMillis(endDate, true);

    if (!Number.isFinite(startMillis) || !Number.isFinite(endMillis) || startMillis > endMillis) {
      errorMessage = "조회 시작일은 종료일보다 늦을 수 없습니다.";
      return;
    }

    loading = true;
    errorMessage = "";
    metadata = null;
    extendedStats = null;
    records = [];
    recordsError = "";

    try {
      const hourTag = Math.floor(Date.now() / 3_600_000);
      const params = `${data.playerId}/${startMillis}/${endMillis}?mode=${selectedMode}&tag=${hourTag}`;
      const stats = await apiGet<PlayerMetadata>(`player_stats/${params}`);
      if (version !== requestVersion) return;
      metadata = stats;

      const [details] = await Promise.all([
        apiGet<PlayerExtendedStats>(`player_extended_stats/${params}`),
        loadRecords(version, startMillis, endMillis),
      ]);
      if (version === requestVersion) extendedStats = details;
    } catch (reason) {
      if (version === requestVersion) errorMessage = getErrorMessage(reason);
    } finally {
      if (version === requestVersion) loading = false;
    }
  }

  function playerFromRecord(record: GameRecordType) {
    return record.players.find((player) => String(player.accountId) === data.playerId);
  }

  onMount(loadPlayer);
</script>

<svelte:head>
  <title>{metadata?.nickname?.trim() || "플레이어"} | 퐁냐</title>
  <meta name="description" content="작혼 4인전 플레이어의 단위, 순위 분포, 화료·방총 통계와 최근 대국을 확인합니다." />
</svelte:head>

<section class="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
  <PageHeader eyebrow="4인전 플레이어" title={metadata?.nickname?.trim() || `플레이어 ${data.playerId}`} description={`플레이어 ID ${data.playerId}`}>
    {#snippet actions()}
      <Button href="/players" variant="secondary">다른 플레이어 검색</Button>
    {/snippet}
  </PageHeader>

  <Card class="mt-8" title="조회 조건">
    <form class="grid gap-4 md:grid-cols-[1fr_1fr_1.3fr_auto] md:items-end" onsubmit={(event) => { event.preventDefault(); loadPlayer(); }}>
      <Input bind:value={startDate} type="date" label="시작일" />
      <Input bind:value={endDate} type="date" label="종료일" />
      <Select bind:value={selectedMode} label="탁·대국 방식">
        <option value={allModesValue}>전체 4인전 단위전</option>
        {#each ALL_MODES as mode}
          <option value={String(mode)}>{modeLabel(mode)}</option>
        {/each}
      </Select>
      <Button type="submit" disabled={loading}>조회</Button>
    </form>
  </Card>

  {#if loading && !metadata}
    <StatusBlock class="mt-8" tone="loading" title="플레이어 통계를 불러오는 중입니다" description="원본 퐁냐 4인전 데이터를 조회하고 있습니다." />
  {:else if errorMessage}
    <StatusBlock class="mt-8" tone="error" title="플레이어 정보를 표시할 수 없습니다" description={errorMessage} actionLabel="검색으로 돌아가기" actionHref="/players" />
  {:else if metadata}
    <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryTile label="현재 단위" value={LevelWithDelta.format(metadata.level)} />
      <SummaryTile label="최고 단위" value={LevelWithDelta.format(metadata.max_level)} />
      <SummaryTile label="기록 대국" value={`${formatNumber(metadata.count)}전`} />
      <SummaryTile label="평균 순위" value={decimal(metadata.avg_rank, 3)} />
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
            <SummaryTile label="평균 타점" value={formatNumber(extendedStats.平均打点)} />
            <SummaryTile label="평균 방총점" value={formatNumber(extendedStats.平均铳点)} />
          </dl>
        {:else}
          <StatusBlock tone="loading" title="상세 통계를 불러오는 중입니다" />
        {/if}
      </Card>
    </div>

    <div class="mt-8 flex items-end justify-between gap-4">
      <div>
        <p class="text-sm font-black text-brand-600">최근 대국</p>
        <h2 class="mt-2 text-2xl font-black text-ink-950">최근 30전</h2>
      </div>
    </div>

    {#if recordsLoading}
      <StatusBlock class="mt-5" tone="loading" title="최근 대국을 불러오는 중입니다" description="처음 조회할 때 사람 확인 작업으로 시간이 조금 더 걸릴 수 있습니다." />
    {:else if recordsError}
      <StatusBlock class="mt-5" tone="error" title="최근 대국을 표시할 수 없습니다" description={recordsError} />
    {:else if !records.length}
      <StatusBlock class="mt-5" title="조건에 맞는 최근 대국이 없습니다" />
    {:else}
      <Table class="mt-5" caption="플레이어 최근 대국" headers={["일시", "탁", "순위", "점수", "상대", "대국"]}>
        {#each records as record (record.uuid)}
          {@const player = playerFromRecord(record)}
          <tr>
            <td class="whitespace-nowrap px-4 py-4">{GameRecord.formatFullStartTime(record)}</td>
            <td class="whitespace-nowrap px-4 py-4 font-bold">{modeLabel(record.modeId)}</td>
            <td class="whitespace-nowrap px-4 py-4 font-black text-brand-700">{player ? GameRecord.getPlayerRankLabel(record, player) : "-"}</td>
            <td class="whitespace-nowrap px-4 py-4">{player ? formatNumber(player.score) : "-"}</td>
            <td class="min-w-56 px-4 py-4 text-xs leading-5">{record.players.filter((item) => String(item.accountId) !== data.playerId).map((item) => item.nickname.trim()).join(" · ")}</td>
            <td class="whitespace-nowrap px-4 py-4">
              <a class="font-black text-brand-700 hover:underline" href={GameRecord.getRecordLink(record, data.playerId)} target="_blank" rel="noreferrer">작혼에서 보기</a>
            </td>
          </tr>
        {/each}
      </Table>
    {/if}
  {/if}
</section>
