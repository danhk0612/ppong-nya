<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import Button from "$lib/components/Button.svelte";
  import Card from "$lib/components/Card.svelte";
  import StatusBlock from "$lib/components/StatusBlock.svelte";
  import Table from "$lib/components/Table.svelte";
  import { formatDateTime, formatNumber, ko } from "$lib/i18n";
  import { createUserDataApi, type GameRecordItem } from "$lib/stores/userData";

  const api = createUserDataApi();
  const recordId = $derived(page.params.id);
  let record = $state<GameRecordItem | undefined>();
  let loading = $state(true);
  let errorMessage = $state("");

  async function loadRecord() {
    loading = true;
    errorMessage = "";

    try {
      const records = await api.listGameRecords();
      record = records.find((item) => item.id === recordId);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : ko.account.unknownDataError;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadRecord();
  });
</script>

<svelte:head>
  <title>대국 상세 | ppong-nya</title>
  <meta name="description" content="ppong-nya에 저장한 대국 기록 상세를 확인합니다." />
</svelte:head>

<section class="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
  <Button href="/records" variant="ghost" size="sm">← 대국 목록</Button>

  {#if loading}
    <StatusBlock class="mt-8" tone="loading" title={ko.account.loading} description="대국 상세 정보를 불러오는 중입니다." />
  {:else if errorMessage}
    <StatusBlock class="mt-8" tone="error" title="대국 상세를 불러오지 못했습니다" description={errorMessage} actionLabel="로그인하기" actionHref="/login" />
  {:else if !record}
    <StatusBlock class="mt-8" title="대국 기록을 찾을 수 없습니다" description="삭제되었거나 현재 계정에 연결되지 않은 대국입니다." actionLabel="목록으로 돌아가기" actionHref="/records" />
  {:else}
    <Card class="mt-6 overflow-hidden" padded={false}>
      <div class="bg-ink-950 p-5 text-white sm:p-8">
        <p class="text-sm font-black text-brand-200">{record.mode}</p>
        <h1 class="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{record.tableName ?? ko.account.records.untitled}</h1>
        <p class="mt-4 text-sm text-ink-300">{formatDateTime(record.startedAt)} · {record.rounds == null ? ko.account.records.noRounds : formatNumber(record.rounds)}국</p>
      </div>
      <div class="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
        <div class="rounded-3xl bg-cream-100 p-5">
          <p class="text-sm font-black text-ink-500">모드</p>
          <p class="mt-2 text-xl font-black text-ink-950">{record.mode}</p>
        </div>
        <div class="rounded-3xl bg-cream-100 p-5">
          <p class="text-sm font-black text-ink-500">국 수</p>
          <p class="mt-2 text-xl font-black text-ink-950">{record.rounds == null ? ko.account.records.noRounds : formatNumber(record.rounds)}</p>
        </div>
        <div class="rounded-3xl bg-cream-100 p-5">
          <p class="text-sm font-black text-ink-500">플레이어</p>
          <p class="mt-2 text-xl font-black text-ink-950">{record.players.length ? `${record.players.length}명` : "-"}</p>
        </div>
      </div>
    </Card>

    {#if record.players.length}
      <Table class="mt-6" caption="대국 플레이어" headers={["순위", "닉네임", "점수"]}>
        {#each record.players as player}
          <tr>
            <td class="whitespace-nowrap px-4 py-4 font-black text-brand-700">{player.placement}</td>
            <td class="px-4 py-4 font-bold text-ink-950">{player.nickname}</td>
            <td class="whitespace-nowrap px-4 py-4">{formatNumber(player.score)}</td>
          </tr>
        {/each}
      </Table>
    {:else}
      <StatusBlock class="mt-6" title="플레이어 정보가 없습니다" description="현재 저장된 MVP 대국에는 플레이어 상세가 없을 수 있습니다." />
    {/if}
  {/if}
</section>
