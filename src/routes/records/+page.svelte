<script lang="ts">
  import { onMount } from "svelte";
  import Button from "$lib/components/Button.svelte";
  import Card from "$lib/components/Card.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import PageSection from "$lib/components/PageSection.svelte";
  import StatusBlock from "$lib/components/StatusBlock.svelte";
  import Table from "$lib/components/Table.svelte";
  import { formatDateTime, formatNumber, ko } from "$lib/i18n";
  import { createUserDataApi, type GameRecordItem } from "$lib/stores/userData";

  const api = createUserDataApi();
  let records = $state<GameRecordItem[]>([]);
  let loading = $state(true);
  let errorMessage = $state("");
  let visibleCount = $state(20);
  const visibleRecords = $derived(records.slice(0, visibleCount));

  async function loadRecords() {
    loading = true;
    errorMessage = "";

    try {
      records = await api.listGameRecords();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : ko.account.unknownDataError;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadRecords();
  });
</script>

<svelte:head>
  <title>대국 목록 | 퐁냐</title>
  <meta name="description" content="퐁냐에 저장한 대국 기록 목록을 확인합니다." />
</svelte:head>

<PageSection>
  <PageHeader
    eyebrow="Records"
    title="대국 목록"
    description="모바일에서는 카드형 목록으로, 태블릿 이상에서는 표 형태로 저장한 대국을 빠르게 탐색합니다."
  >
    {#snippet actions()}
      <Button href="/account" variant="secondary">계정에서 대국 추가</Button>
    {/snippet}
  </PageHeader>

  {#if loading}
    <StatusBlock class="mt-8" tone="loading" title={ko.account.loading} description="대국 기록을 불러오는 중입니다." />
  {:else if errorMessage}
    <StatusBlock class="mt-8" tone="error" title="대국 목록을 불러오지 못했습니다" description={errorMessage} actionLabel="로그인하기" actionHref="/login" />
  {:else if records.length === 0}
    <StatusBlock class="mt-8" title={ko.account.records.empty} description="계정 화면에서 첫 대국 기록을 추가하면 이곳에 목록과 상세 링크가 표시됩니다." actionLabel="대국 추가하기" actionHref="/account" />
  {:else}
    <div class="mt-8 grid gap-3 md:hidden">
      {#each visibleRecords as record}
        <Card>
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.2em] text-brand-600">{record.mode}</p>
              <h2 class="mt-2 text-lg font-black text-ink-950">{record.tableName ?? ko.account.records.untitled}</h2>
              <p class="mt-2 text-sm text-ink-500">{formatDateTime(record.startedAt)} · {record.rounds == null ? ko.account.records.noRounds : formatNumber(record.rounds)}국</p>
            </div>
            <Button href={`/records/${record.id}`} size="sm">상세</Button>
          </div>
        </Card>
      {/each}
    </div>

    <Table class="mt-8 hidden md:block" caption="저장한 대국 기록" headers={["모드", "탁", "시작", "국 수", "플레이어", "상세"]}>
      {#each visibleRecords as record}
        <tr class="hover:bg-brand-50/50">
          <td class="whitespace-nowrap px-4 py-4 font-black text-brand-700">{record.mode}</td>
          <td class="px-4 py-4 font-bold text-ink-950">{record.tableName ?? ko.account.records.untitled}</td>
          <td class="whitespace-nowrap px-4 py-4">{formatDateTime(record.startedAt)}</td>
          <td class="whitespace-nowrap px-4 py-4">{record.rounds == null ? ko.account.records.noRounds : formatNumber(record.rounds)}국</td>
          <td class="px-4 py-4">{record.players.length ? `${record.players.length}명` : "-"}</td>
          <td class="whitespace-nowrap px-4 py-4"><a class="font-black text-brand-700 hover:text-brand-900" href={`/records/${record.id}`}>보기</a></td>
        </tr>
      {/each}
    </Table>

    {#if visibleCount < records.length}
      <div class="mt-6 flex justify-center">
        <Button variant="secondary" onclick={() => (visibleCount += 20)}>더 보기</Button>
      </div>
    {/if}
  {/if}
</PageSection>
