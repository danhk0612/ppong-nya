<script lang="ts">
  import { onMount } from "svelte";
  import Button from "$lib/components/Button.svelte";
  import Card from "$lib/components/Card.svelte";
  import Input from "$lib/components/Input.svelte";
  import Select from "$lib/components/Select.svelte";
  import StatusBlock from "$lib/components/StatusBlock.svelte";
  import Toast from "$lib/components/Toast.svelte";
  import {
    createUserDataApi,
    type FavoritePlayerItem,
    type GameNoteItem,
    type GameRecordItem,
    type UserPreferenceItem,
  } from "$lib/stores/userData";
  import { formatDate, formatDateTime, formatNumber, ko } from "$lib/i18n";

  let { data } = $props();
  const user = $derived(data.user);
  const session = $derived(data.session);
  const accounts = $derived(data.accounts);
  const databaseSession = $derived(data.databaseSession);
  const api = createUserDataApi();

  let preferences = $state<UserPreferenceItem[]>([]);
  let favorites = $state<FavoritePlayerItem[]>([]);
  let gameRecords = $state<GameRecordItem[]>([]);
  let notes = $state<GameNoteItem[]>([]);
  let loading = $state(true);
  let message = $state("");
  let errorMessage = $state("");

  let preferenceKey = $state("locale");
  let preferenceValue = $state("ko");
  let favoritePlayerId = $state("");
  let favoriteNickname = $state("");
  let favoriteServer = $state("");
  let favoriteMemo = $state("");
  let recordMode = $state<"SANMA" | "YONMA">("YONMA");
  let recordTableName = $state("");
  let recordRounds = $state(8);
  let noteTitle = $state("");
  let noteBody = $state("");
  let noteGameRecordId = $state("");

  async function loadUserData() {
    loading = true;
    errorMessage = "";

    try {
      [preferences, favorites, gameRecords, notes] = await Promise.all([
        api.listPreferences(),
        api.listFavorites(),
        api.listGameRecords(),
        api.listNotes(),
      ]);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : ko.account.unknownDataError;
    } finally {
      loading = false;
    }
  }

  async function submitPreference() {
    await runAction(async () => {
      await api.savePreference(preferenceKey, preferenceValue);
      preferenceValue = "";
    }, ko.account.messages.preferenceSaved);
  }

  async function submitFavorite() {
    await runAction(async () => {
      await api.saveFavorite({
        playerId: favoritePlayerId,
        nickname: favoriteNickname,
        server: favoriteServer || undefined,
        memo: favoriteMemo || undefined,
      });
      favoritePlayerId = "";
      favoriteNickname = "";
      favoriteServer = "";
      favoriteMemo = "";
    }, ko.account.messages.favoriteSaved);
  }

  async function submitGameRecord() {
    await runAction(async () => {
      await api.saveGameRecord({
        mode: recordMode,
        tableName: recordTableName || undefined,
        rounds: recordRounds,
      });
      recordTableName = "";
    }, ko.account.messages.recordSaved);
  }

  async function submitNote() {
    await runAction(async () => {
      await api.saveNote({
        title: noteTitle,
        body: noteBody,
        gameRecordId: noteGameRecordId || undefined,
      });
      noteTitle = "";
      noteBody = "";
      noteGameRecordId = "";
    }, ko.account.messages.noteSaved);
  }

  async function removeItem(remove: () => Promise<unknown>, successMessage: string) {
    await runAction(remove, successMessage);
  }

  async function runAction(action: () => Promise<unknown>, successMessage: string) {
    errorMessage = "";
    message = "";

    try {
      await action();
      message = successMessage;
      await loadUserData();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : ko.account.unknownRequestError;
    }
  }

  onMount(() => {
    void loadUserData();
  });
</script>

<svelte:head>
  <title>{ko.account.title}</title>
  <meta name="description" content={ko.account.description} />
</svelte:head>

<section class="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
  <Card class="overflow-hidden" padded={false}>
    <div class="bg-ink-950 p-5 text-white sm:p-8">
      <div class="flex flex-col gap-5 sm:flex-row sm:items-center">
        {#if user.image}
          <img class="h-20 w-20 rounded-3xl object-cover sm:h-24 sm:w-24" src={user.image} alt={ko.nav.account} referrerpolicy="no-referrer" />
        {:else}
          <div class="grid h-20 w-20 place-items-center rounded-3xl bg-brand-100 text-3xl font-black text-brand-700 sm:h-24 sm:w-24" aria-hidden="true">
            {user.email?.slice(0, 1).toUpperCase() ?? "?"}
          </div>
        {/if}
        <div class="min-w-0">
          <p class="text-sm font-black text-brand-200">{ko.account.providerLabel}</p>
          <h1 class="mt-2 truncate text-3xl font-black tracking-tight sm:text-4xl">{user.name ?? ko.account.unnamedUser}</h1>
          <p class="mt-2 break-all text-ink-300">{user.email}</p>
        </div>
      </div>
    </div>

    <div class="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
      <div class="rounded-3xl bg-cream-100 p-5">
        <dt class="text-sm font-black text-ink-500">{ko.account.userId}</dt>
        <dd class="mt-2 break-all font-mono text-sm text-ink-900">{user.id}</dd>
      </div>
      <div class="rounded-3xl bg-cream-100 p-5">
        <dt class="text-sm font-black text-ink-500">{ko.account.role}</dt>
        <dd class="mt-2 font-black text-ink-900">{user.role}</dd>
      </div>
    </div>
  </Card>

  <Card class="mt-6 border-brand-100 bg-brand-50/80" title={ko.account.scopeTitle}>
    <p class="text-sm leading-6 text-ink-600">{ko.account.scopeDescription}</p>
  </Card>

  <div class="mt-6 grid gap-6 lg:grid-cols-2">
    <Card title={ko.account.sessionTitle}>
      <dl class="grid gap-4">
        <div class="rounded-3xl bg-cream-100 p-5">
          <dt class="text-sm font-black text-ink-500">{ko.account.sessionExpires}</dt>
          <dd class="mt-2 font-mono text-sm text-ink-900">{formatDateTime(session.expires)}</dd>
        </div>
        {#if databaseSession}
          <div class="rounded-3xl bg-cream-100 p-5">
            <dt class="text-sm font-black text-ink-500">{ko.account.databaseSessionId}</dt>
            <dd class="mt-2 break-all font-mono text-sm text-ink-900">{databaseSession.id}</dd>
          </div>
          <div class="rounded-3xl bg-cream-100 p-5">
            <dt class="text-sm font-black text-ink-500">{ko.account.databaseSessionExpires}</dt>
            <dd class="mt-2 font-mono text-sm text-ink-900">{formatDateTime(databaseSession.expires)}</dd>
          </div>
        {:else}
          <StatusBlock title={ko.account.databaseSessionMissing} />
        {/if}
      </dl>
    </Card>

    <Card title={ko.account.accountTitle}>
      <div class="grid gap-4">
        {#each accounts as account}
          <article class="rounded-3xl border border-ink-100 bg-white p-5">
            <dl class="grid gap-3 text-sm">
              <div>
                <dt class="font-black text-ink-500">{ko.account.accountProvider}</dt>
                <dd class="mt-1 font-black text-ink-900">{account.provider}</dd>
              </div>
              <div>
                <dt class="font-black text-ink-500">{ko.account.accountType}</dt>
                <dd class="mt-1 text-ink-900">{account.type}</dd>
              </div>
              <div>
                <dt class="font-black text-ink-500">{ko.account.accountProviderId}</dt>
                <dd class="mt-1 break-all font-mono text-ink-900">{account.providerAccountId}</dd>
              </div>
              <div>
                <dt class="font-black text-ink-500">{ko.account.accountScope}</dt>
                <dd class="mt-1 break-all text-ink-900">{account.scope ?? "-"}</dd>
              </div>
              <div>
                <dt class="font-black text-ink-500">{ko.account.accountConnectedAt}</dt>
                <dd class="mt-1 font-mono text-ink-900">{formatDateTime(account.createdAt)}</dd>
              </div>
            </dl>
          </article>
        {:else}
          <StatusBlock title={ko.account.noAccount} />
        {/each}
      </div>
    </Card>
  </div>

  <div class="mt-6 grid gap-3">
    <Toast message={message} tone="success" />
    <Toast message={errorMessage} tone="error" />
  </div>

  {#if loading}
    <StatusBlock class="mt-6" tone="loading" title={ko.account.loading} description="저장된 개인 데이터를 안전하게 불러오고 있습니다." />
  {/if}

  <div class="mt-6 grid gap-6 lg:grid-cols-2">
    <Card title={ko.account.preferences.title}>
      <form class="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onsubmit={(event) => { event.preventDefault(); void submitPreference(); }}>
        <Input bind:value={preferenceKey} placeholder={ko.account.preferences.keyPlaceholder} aria-label={ko.account.preferences.keyPlaceholder} required />
        <Input bind:value={preferenceValue} placeholder={ko.account.preferences.valuePlaceholder} aria-label={ko.account.preferences.valuePlaceholder} required />
        <Button class="w-full sm:w-auto" type="submit" aria-label={ko.account.preferences.save}>{ko.account.preferences.save}</Button>
      </form>
      <div class="mt-5 divide-y divide-ink-100">
        {#each preferences as preference}
          <article class="flex flex-col gap-3 py-4 xs:flex-row xs:items-center xs:justify-between">
            <div class="min-w-0">
              <p class="font-black text-ink-900">{preference.key}</p>
              <p class="break-all text-sm text-ink-500">{JSON.stringify(preference.value)}</p>
            </div>
            <Button variant="ghost" size="sm" aria-label={ko.account.preferences.delete} onclick={() => removeItem(() => api.deletePreference(preference.id), ko.account.messages.preferenceDeleted)}>{ko.account.preferences.delete}</Button>
          </article>
        {:else}
          <StatusBlock title={ko.account.preferences.empty} />
        {/each}
      </div>
    </Card>

    <Card title={ko.account.favorites.title}>
      <form class="grid gap-3" onsubmit={(event) => { event.preventDefault(); void submitFavorite(); }}>
        <div class="grid gap-3 sm:grid-cols-2">
          <Input bind:value={favoritePlayerId} placeholder={ko.account.favorites.playerIdPlaceholder} aria-label={ko.account.favorites.playerIdPlaceholder} required />
          <Input bind:value={favoriteNickname} placeholder={ko.account.favorites.nicknamePlaceholder} aria-label={ko.account.favorites.nicknamePlaceholder} required />
          <Input bind:value={favoriteServer} placeholder={ko.account.favorites.serverPlaceholder} aria-label={ko.account.favorites.serverPlaceholder} />
          <Input bind:value={favoriteMemo} placeholder={ko.account.favorites.memoPlaceholder} aria-label={ko.account.favorites.memoPlaceholder} />
        </div>
        <Button class="w-full" type="submit" aria-label={ko.account.favorites.save}>{ko.account.favorites.save}</Button>
      </form>
      <div class="mt-5 divide-y divide-ink-100">
        {#each favorites as favorite}
          <article class="flex flex-col gap-3 py-4 xs:flex-row xs:items-center xs:justify-between">
            <div>
              <p class="font-black text-ink-900">{favorite.nickname}</p>
              <p class="text-sm text-ink-500">{favorite.playerId}{favorite.server ? ` · ${favorite.server}` : ""}</p>
            </div>
            <Button variant="ghost" size="sm" aria-label={ko.account.favorites.delete} onclick={() => removeItem(() => api.deleteFavorite(favorite.id), ko.account.messages.favoriteDeleted)}>{ko.account.favorites.delete}</Button>
          </article>
        {:else}
          <StatusBlock title={ko.account.favorites.empty} />
        {/each}
      </div>
    </Card>

    <Card title={ko.account.records.title}>
      <form class="grid gap-3" onsubmit={(event) => { event.preventDefault(); void submitGameRecord(); }}>
        <div class="grid gap-3 sm:grid-cols-3">
          <Select bind:value={recordMode} aria-label={ko.account.records.title}>
            <option value="YONMA">{ko.account.records.yonma}</option>
            <option value="SANMA">{ko.account.records.sanma}</option>
          </Select>
          <Input bind:value={recordTableName} placeholder={ko.account.records.tablePlaceholder} aria-label={ko.account.records.tablePlaceholder} />
          <Input type="number" min="1" bind:value={recordRounds} placeholder={ko.account.records.roundsPlaceholder} aria-label={ko.account.records.roundsPlaceholder} />
        </div>
        <Button class="w-full" type="submit" aria-label={ko.account.records.add}>{ko.account.records.add}</Button>
      </form>
      <div class="mt-5 divide-y divide-ink-100">
        {#each gameRecords as record}
          <article class="flex flex-col gap-3 py-4 xs:flex-row xs:items-center xs:justify-between">
            <div>
              <a class="font-black text-ink-900 hover:text-brand-700" href={`/records/${record.id}`}>{record.mode} · {record.tableName ?? ko.account.records.untitled}</a>
              <p class="text-sm text-ink-500">{formatDateTime(record.startedAt)} · {record.rounds == null ? ko.account.records.noRounds : formatNumber(record.rounds)}국</p>
            </div>
            <Button variant="ghost" size="sm" aria-label={ko.account.records.delete} onclick={() => removeItem(() => api.deleteGameRecord(record.id), ko.account.messages.recordDeleted)}>{ko.account.records.delete}</Button>
          </article>
        {:else}
          <StatusBlock title={ko.account.records.empty} actionLabel="대국 목록 보기" actionHref="/records" />
        {/each}
      </div>
    </Card>

    <Card title={ko.account.notes.title}>
      <form class="grid gap-3" onsubmit={(event) => { event.preventDefault(); void submitNote(); }}>
        <Input bind:value={noteTitle} placeholder={ko.account.notes.titlePlaceholder} aria-label={ko.account.notes.titlePlaceholder} required />
        <Select bind:value={noteGameRecordId} aria-label={ko.account.notes.noRecord}>
          <option value="">{ko.account.notes.noRecord}</option>
          {#each gameRecords as record}
            <option value={record.id}>{record.mode} · {record.tableName ?? formatDate(record.startedAt)}</option>
          {/each}
        </Select>
        <textarea class="min-h-32 w-full rounded-2xl border border-ink-200 bg-white px-4 py-3 text-base text-ink-950 outline-none transition placeholder:text-ink-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-100" bind:value={noteBody} placeholder={ko.account.notes.bodyPlaceholder} aria-label={ko.account.notes.bodyPlaceholder} required></textarea>
        <Button class="w-full" type="submit" aria-label={ko.account.notes.save}>{ko.account.notes.save}</Button>
      </form>
      <div class="mt-5 divide-y divide-ink-100">
        {#each notes as note}
          <article class="flex flex-col gap-3 py-4 xs:flex-row xs:items-start xs:justify-between">
            <div class="min-w-0">
              <p class="font-black text-ink-900">{note.title}</p>
              <p class="mt-1 line-clamp-2 text-sm text-ink-500">{note.body}</p>
            </div>
            <Button variant="ghost" size="sm" aria-label={ko.account.notes.delete} onclick={() => removeItem(() => api.deleteNote(note.id), ko.account.messages.noteDeleted)}>{ko.account.notes.delete}</Button>
          </article>
        {:else}
          <StatusBlock title={ko.account.notes.empty} />
        {/each}
      </div>
    </Card>
  </div>
</section>
