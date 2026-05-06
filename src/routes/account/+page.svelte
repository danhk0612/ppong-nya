<script lang="ts">
  import { onMount } from "svelte";
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

<section class="mx-auto max-w-6xl px-6 py-16">
  <div class="rounded-[2rem] border border-white/70 bg-white p-8 shadow-xl shadow-slate-200">
    <div class="flex flex-col gap-6 sm:flex-row sm:items-center">
      {#if user.image}
        <img class="h-24 w-24 rounded-3xl object-cover" src={user.image} alt={ko.nav.account} referrerpolicy="no-referrer" />
      {:else}
        <div class="grid h-24 w-24 place-items-center rounded-3xl bg-pink-100 text-3xl font-black text-pink-700" aria-hidden="true">
          {user.email?.slice(0, 1).toUpperCase() ?? "?"}
        </div>
      {/if}
      <div>
        <p class="text-sm font-semibold text-pink-600">{ko.account.providerLabel}</p>
        <h1 class="mt-2 text-3xl font-black tracking-tight text-slate-950">{user.name ?? ko.account.unnamedUser}</h1>
        <p class="mt-2 text-slate-600">{user.email}</p>
      </div>
    </div>

    <dl class="mt-10 grid gap-4 sm:grid-cols-2">
      <div class="rounded-2xl bg-slate-50 p-5">
        <dt class="text-sm font-semibold text-slate-500">{ko.account.userId}</dt>
        <dd class="mt-2 break-all font-mono text-sm text-slate-900">{user.id}</dd>
      </div>
      <div class="rounded-2xl bg-slate-50 p-5">
        <dt class="text-sm font-semibold text-slate-500">{ko.account.role}</dt>
        <dd class="mt-2 font-semibold text-slate-900">{user.role}</dd>
      </div>
    </dl>
  </div>

  <div class="mt-8 rounded-[2rem] border border-pink-100 bg-pink-50 p-6">
    <h2 class="text-xl font-black text-slate-950">{ko.account.scopeTitle}</h2>
    <p class="mt-2 text-sm leading-6 text-slate-600">{ko.account.scopeDescription}</p>
  </div>

  {#if message}
    <p class="mt-6 rounded-2xl bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700">{message}</p>
  {/if}
  {#if errorMessage}
    <p class="mt-6 rounded-2xl bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700">{errorMessage}</p>
  {/if}

  <div class="mt-8 grid gap-6 lg:grid-cols-2">
    <section class="rounded-[2rem] border border-white/70 bg-white p-6 shadow-lg shadow-slate-200">
      <h2 class="text-xl font-black text-slate-950">{ko.account.preferences.title}</h2>
      <form class="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onsubmit={(event) => { event.preventDefault(); void submitPreference(); }}>
        <input class="rounded-2xl border border-slate-200 px-4 py-3" bind:value={preferenceKey} placeholder={ko.account.preferences.keyPlaceholder} aria-label={ko.account.preferences.keyPlaceholder} required />
        <input class="rounded-2xl border border-slate-200 px-4 py-3" bind:value={preferenceValue} placeholder={ko.account.preferences.valuePlaceholder} aria-label={ko.account.preferences.valuePlaceholder} required />
        <button class="rounded-2xl bg-pink-500 px-5 py-3 font-semibold text-white hover:bg-pink-600" aria-label={ko.account.preferences.save}>{ko.account.preferences.save}</button>
      </form>
      <div class="mt-5 divide-y divide-slate-100">
        {#each preferences as preference}
          <article class="flex items-center justify-between gap-4 py-3">
            <div>
              <p class="font-semibold text-slate-900">{preference.key}</p>
              <p class="text-sm text-slate-500">{JSON.stringify(preference.value)}</p>
            </div>
            <button class="text-sm font-semibold text-rose-600" aria-label={ko.account.preferences.delete} onclick={() => removeItem(() => api.deletePreference(preference.id), ko.account.messages.preferenceDeleted)}>{ko.account.preferences.delete}</button>
          </article>
        {:else}
          <p class="py-4 text-sm text-slate-500">{ko.account.preferences.empty}</p>
        {/each}
      </div>
    </section>

    <section class="rounded-[2rem] border border-white/70 bg-white p-6 shadow-lg shadow-slate-200">
      <h2 class="text-xl font-black text-slate-950">{ko.account.favorites.title}</h2>
      <form class="mt-5 grid gap-3" onsubmit={(event) => { event.preventDefault(); void submitFavorite(); }}>
        <div class="grid gap-3 sm:grid-cols-2">
          <input class="rounded-2xl border border-slate-200 px-4 py-3" bind:value={favoritePlayerId} placeholder={ko.account.favorites.playerIdPlaceholder} aria-label={ko.account.favorites.playerIdPlaceholder} required />
          <input class="rounded-2xl border border-slate-200 px-4 py-3" bind:value={favoriteNickname} placeholder={ko.account.favorites.nicknamePlaceholder} aria-label={ko.account.favorites.nicknamePlaceholder} required />
          <input class="rounded-2xl border border-slate-200 px-4 py-3" bind:value={favoriteServer} placeholder={ko.account.favorites.serverPlaceholder} aria-label={ko.account.favorites.serverPlaceholder} />
          <input class="rounded-2xl border border-slate-200 px-4 py-3" bind:value={favoriteMemo} placeholder={ko.account.favorites.memoPlaceholder} aria-label={ko.account.favorites.memoPlaceholder} />
        </div>
        <button class="rounded-2xl bg-pink-500 px-5 py-3 font-semibold text-white hover:bg-pink-600" aria-label={ko.account.favorites.save}>{ko.account.favorites.save}</button>
      </form>
      <div class="mt-5 divide-y divide-slate-100">
        {#each favorites as favorite}
          <article class="flex items-center justify-between gap-4 py-3">
            <div>
              <p class="font-semibold text-slate-900">{favorite.nickname}</p>
              <p class="text-sm text-slate-500">{favorite.playerId}{favorite.server ? ` · ${favorite.server}` : ""}</p>
            </div>
            <button class="text-sm font-semibold text-rose-600" aria-label={ko.account.favorites.delete} onclick={() => removeItem(() => api.deleteFavorite(favorite.id), ko.account.messages.favoriteDeleted)}>{ko.account.favorites.delete}</button>
          </article>
        {:else}
          <p class="py-4 text-sm text-slate-500">{ko.account.favorites.empty}</p>
        {/each}
      </div>
    </section>

    <section class="rounded-[2rem] border border-white/70 bg-white p-6 shadow-lg shadow-slate-200">
      <h2 class="text-xl font-black text-slate-950">{ko.account.records.title}</h2>
      <form class="mt-5 grid gap-3" onsubmit={(event) => { event.preventDefault(); void submitGameRecord(); }}>
        <div class="grid gap-3 sm:grid-cols-3">
          <select class="rounded-2xl border border-slate-200 px-4 py-3" bind:value={recordMode} aria-label={ko.account.records.title}>
            <option value="YONMA">{ko.account.records.yonma}</option>
            <option value="SANMA">{ko.account.records.sanma}</option>
          </select>
          <input class="rounded-2xl border border-slate-200 px-4 py-3" bind:value={recordTableName} placeholder={ko.account.records.tablePlaceholder} aria-label={ko.account.records.tablePlaceholder} />
          <input class="rounded-2xl border border-slate-200 px-4 py-3" type="number" min="1" bind:value={recordRounds} placeholder={ko.account.records.roundsPlaceholder} aria-label={ko.account.records.roundsPlaceholder} />
        </div>
        <button class="rounded-2xl bg-pink-500 px-5 py-3 font-semibold text-white hover:bg-pink-600" aria-label={ko.account.records.add}>{ko.account.records.add}</button>
      </form>
      <div class="mt-5 divide-y divide-slate-100">
        {#each gameRecords as record}
          <article class="flex items-center justify-between gap-4 py-3">
            <div>
              <p class="font-semibold text-slate-900">{record.mode} · {record.tableName ?? ko.account.records.untitled}</p>
              <p class="text-sm text-slate-500">{formatDateTime(record.startedAt)} · {record.rounds == null ? ko.account.records.noRounds : formatNumber(record.rounds)}국</p>
            </div>
            <button class="text-sm font-semibold text-rose-600" aria-label={ko.account.records.delete} onclick={() => removeItem(() => api.deleteGameRecord(record.id), ko.account.messages.recordDeleted)}>{ko.account.records.delete}</button>
          </article>
        {:else}
          <p class="py-4 text-sm text-slate-500">{ko.account.records.empty}</p>
        {/each}
      </div>
    </section>

    <section class="rounded-[2rem] border border-white/70 bg-white p-6 shadow-lg shadow-slate-200">
      <h2 class="text-xl font-black text-slate-950">{ko.account.notes.title}</h2>
      <form class="mt-5 grid gap-3" onsubmit={(event) => { event.preventDefault(); void submitNote(); }}>
        <input class="rounded-2xl border border-slate-200 px-4 py-3" bind:value={noteTitle} placeholder={ko.account.notes.titlePlaceholder} aria-label={ko.account.notes.titlePlaceholder} required />
        <select class="rounded-2xl border border-slate-200 px-4 py-3" bind:value={noteGameRecordId} aria-label={ko.account.notes.noRecord}>
          <option value="">{ko.account.notes.noRecord}</option>
          {#each gameRecords as record}
            <option value={record.id}>{record.mode} · {record.tableName ?? formatDate(record.startedAt)}</option>
          {/each}
        </select>
        <textarea class="min-h-28 rounded-2xl border border-slate-200 px-4 py-3" bind:value={noteBody} placeholder={ko.account.notes.bodyPlaceholder} aria-label={ko.account.notes.bodyPlaceholder} required></textarea>
        <button class="rounded-2xl bg-pink-500 px-5 py-3 font-semibold text-white hover:bg-pink-600" aria-label={ko.account.notes.save}>{ko.account.notes.save}</button>
      </form>
      <div class="mt-5 divide-y divide-slate-100">
        {#each notes as note}
          <article class="flex items-start justify-between gap-4 py-3">
            <div>
              <p class="font-semibold text-slate-900">{note.title}</p>
              <p class="mt-1 line-clamp-2 text-sm text-slate-500">{note.body}</p>
            </div>
            <button class="text-sm font-semibold text-rose-600" aria-label={ko.account.notes.delete} onclick={() => removeItem(() => api.deleteNote(note.id), ko.account.messages.noteDeleted)}>{ko.account.notes.delete}</button>
          </article>
        {:else}
          <p class="py-4 text-sm text-slate-500">{ko.account.notes.empty}</p>
        {/each}
      </div>
    </section>
  </div>

  {#if loading}
    <p class="mt-8 rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-slate-500 shadow-sm">{ko.account.loading}</p>
  {/if}
</section>
