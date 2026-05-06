<script lang="ts">
  import { onMount } from "svelte";
  import {
    createUserDataApi,
    type FavoritePlayerItem,
    type GameNoteItem,
    type GameRecordItem,
    type UserPreferenceItem,
  } from "$lib/stores/userData";

  let { data } = $props();
  const user = data.user;
  const api = createUserDataApi();

  let preferences: UserPreferenceItem[] = [];
  let favorites: FavoritePlayerItem[] = [];
  let gameRecords: GameRecordItem[] = [];
  let notes: GameNoteItem[] = [];
  let loading = true;
  let message = "";
  let errorMessage = "";

  let preferenceKey = "locale";
  let preferenceValue = "ko";
  let favoritePlayerId = "";
  let favoriteNickname = "";
  let favoriteServer = "";
  let favoriteMemo = "";
  let recordMode: "SANMA" | "YONMA" = "YONMA";
  let recordTableName = "";
  let recordRounds = 8;
  let noteTitle = "";
  let noteBody = "";
  let noteGameRecordId = "";

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
      errorMessage = error instanceof Error ? error.message : "데이터를 불러오지 못했습니다.";
    } finally {
      loading = false;
    }
  }

  async function submitPreference() {
    await runAction(async () => {
      await api.savePreference(preferenceKey, preferenceValue);
      preferenceValue = "";
    }, "사용자 설정을 저장했습니다.");
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
    }, "즐겨찾기 플레이어를 저장했습니다.");
  }

  async function submitGameRecord() {
    await runAction(async () => {
      await api.saveGameRecord({
        mode: recordMode,
        tableName: recordTableName || undefined,
        rounds: recordRounds,
      });
      recordTableName = "";
    }, "대국 기록을 저장했습니다.");
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
    }, "대국 메모를 저장했습니다.");
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
      errorMessage = error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
    }
  }

  onMount(() => {
    void loadUserData();
  });
</script>

<svelte:head>
  <title>계정 관리 | ppong-nya</title>
  <meta name="description" content="ppong-nya 로그인 계정과 개인 데이터를 관리합니다." />
</svelte:head>

<section class="mx-auto max-w-6xl px-6 py-16">
  <div class="rounded-[2rem] border border-white/70 bg-white p-8 shadow-xl shadow-slate-200">
    <div class="flex flex-col gap-6 sm:flex-row sm:items-center">
      {#if user.image}
        <img class="h-24 w-24 rounded-3xl object-cover" src={user.image} alt="" referrerpolicy="no-referrer" />
      {:else}
        <div class="grid h-24 w-24 place-items-center rounded-3xl bg-pink-100 text-3xl font-black text-pink-700">
          {user.email?.slice(0, 1).toUpperCase() ?? "?"}
        </div>
      {/if}
      <div>
        <p class="text-sm font-semibold text-pink-600">Google 로그인 계정</p>
        <h1 class="mt-2 text-3xl font-black tracking-tight text-slate-950">{user.name ?? "이름 없는 사용자"}</h1>
        <p class="mt-2 text-slate-600">{user.email}</p>
      </div>
    </div>

    <dl class="mt-10 grid gap-4 sm:grid-cols-2">
      <div class="rounded-2xl bg-slate-50 p-5">
        <dt class="text-sm font-semibold text-slate-500">사용자 ID</dt>
        <dd class="mt-2 break-all font-mono text-sm text-slate-900">{user.id}</dd>
      </div>
      <div class="rounded-2xl bg-slate-50 p-5">
        <dt class="text-sm font-semibold text-slate-500">권한</dt>
        <dd class="mt-2 font-semibold text-slate-900">{user.role}</dd>
      </div>
    </dl>
  </div>

  <div class="mt-8 rounded-[2rem] border border-pink-100 bg-pink-50 p-6">
    <h2 class="text-xl font-black text-slate-950">저장 데이터 범위</h2>
    <p class="mt-2 text-sm leading-6 text-slate-600">
      ppong-nya는 사용자 설정, 즐겨찾기 플레이어, 대국 기록, 대국 메모, 검색 기록, 통계 캐시를 사용자 계정에
      연결해 저장합니다. 이 화면은 우선 네 가지 CRUD API를 호출해 기본 데이터를 관리합니다.
    </p>
  </div>

  {#if message}
    <p class="mt-6 rounded-2xl bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700">{message}</p>
  {/if}
  {#if errorMessage}
    <p class="mt-6 rounded-2xl bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700">{errorMessage}</p>
  {/if}

  <div class="mt-8 grid gap-6 lg:grid-cols-2">
    <section class="rounded-[2rem] border border-white/70 bg-white p-6 shadow-lg shadow-slate-200">
      <h2 class="text-xl font-black text-slate-950">사용자 설정</h2>
      <form class="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onsubmit={(event) => { event.preventDefault(); void submitPreference(); }}>
        <input class="rounded-2xl border border-slate-200 px-4 py-3" bind:value={preferenceKey} placeholder="키" required />
        <input class="rounded-2xl border border-slate-200 px-4 py-3" bind:value={preferenceValue} placeholder="값" required />
        <button class="rounded-2xl bg-pink-500 px-5 py-3 font-semibold text-white hover:bg-pink-600">저장</button>
      </form>
      <div class="mt-5 divide-y divide-slate-100">
        {#each preferences as preference}
          <article class="flex items-center justify-between gap-4 py-3">
            <div>
              <p class="font-semibold text-slate-900">{preference.key}</p>
              <p class="text-sm text-slate-500">{JSON.stringify(preference.value)}</p>
            </div>
            <button class="text-sm font-semibold text-rose-600" onclick={() => removeItem(() => api.deletePreference(preference.id), "설정을 삭제했습니다.")}>삭제</button>
          </article>
        {:else}
          <p class="py-4 text-sm text-slate-500">저장된 설정이 없습니다.</p>
        {/each}
      </div>
    </section>

    <section class="rounded-[2rem] border border-white/70 bg-white p-6 shadow-lg shadow-slate-200">
      <h2 class="text-xl font-black text-slate-950">즐겨찾기 플레이어</h2>
      <form class="mt-5 grid gap-3" onsubmit={(event) => { event.preventDefault(); void submitFavorite(); }}>
        <div class="grid gap-3 sm:grid-cols-2">
          <input class="rounded-2xl border border-slate-200 px-4 py-3" bind:value={favoritePlayerId} placeholder="플레이어 ID" required />
          <input class="rounded-2xl border border-slate-200 px-4 py-3" bind:value={favoriteNickname} placeholder="닉네임" required />
          <input class="rounded-2xl border border-slate-200 px-4 py-3" bind:value={favoriteServer} placeholder="서버" />
          <input class="rounded-2xl border border-slate-200 px-4 py-3" bind:value={favoriteMemo} placeholder="메모" />
        </div>
        <button class="rounded-2xl bg-pink-500 px-5 py-3 font-semibold text-white hover:bg-pink-600">저장</button>
      </form>
      <div class="mt-5 divide-y divide-slate-100">
        {#each favorites as favorite}
          <article class="flex items-center justify-between gap-4 py-3">
            <div>
              <p class="font-semibold text-slate-900">{favorite.nickname}</p>
              <p class="text-sm text-slate-500">{favorite.playerId}{favorite.server ? ` · ${favorite.server}` : ""}</p>
            </div>
            <button class="text-sm font-semibold text-rose-600" onclick={() => removeItem(() => api.deleteFavorite(favorite.id), "즐겨찾기를 삭제했습니다.")}>삭제</button>
          </article>
        {:else}
          <p class="py-4 text-sm text-slate-500">즐겨찾기 플레이어가 없습니다.</p>
        {/each}
      </div>
    </section>

    <section class="rounded-[2rem] border border-white/70 bg-white p-6 shadow-lg shadow-slate-200">
      <h2 class="text-xl font-black text-slate-950">대국 기록</h2>
      <form class="mt-5 grid gap-3" onsubmit={(event) => { event.preventDefault(); void submitGameRecord(); }}>
        <div class="grid gap-3 sm:grid-cols-3">
          <select class="rounded-2xl border border-slate-200 px-4 py-3" bind:value={recordMode}>
            <option value="YONMA">4인전</option>
            <option value="SANMA">3인전</option>
          </select>
          <input class="rounded-2xl border border-slate-200 px-4 py-3" bind:value={recordTableName} placeholder="탁 이름" />
          <input class="rounded-2xl border border-slate-200 px-4 py-3" type="number" min="1" bind:value={recordRounds} placeholder="국 수" />
        </div>
        <button class="rounded-2xl bg-pink-500 px-5 py-3 font-semibold text-white hover:bg-pink-600">추가</button>
      </form>
      <div class="mt-5 divide-y divide-slate-100">
        {#each gameRecords as record}
          <article class="flex items-center justify-between gap-4 py-3">
            <div>
              <p class="font-semibold text-slate-900">{record.mode} · {record.tableName ?? "이름 없는 대국"}</p>
              <p class="text-sm text-slate-500">{new Date(record.startedAt).toLocaleString()} · {record.rounds ?? "?"}국</p>
            </div>
            <button class="text-sm font-semibold text-rose-600" onclick={() => removeItem(() => api.deleteGameRecord(record.id), "대국 기록을 삭제했습니다.")}>삭제</button>
          </article>
        {:else}
          <p class="py-4 text-sm text-slate-500">대국 기록이 없습니다.</p>
        {/each}
      </div>
    </section>

    <section class="rounded-[2rem] border border-white/70 bg-white p-6 shadow-lg shadow-slate-200">
      <h2 class="text-xl font-black text-slate-950">대국 메모</h2>
      <form class="mt-5 grid gap-3" onsubmit={(event) => { event.preventDefault(); void submitNote(); }}>
        <input class="rounded-2xl border border-slate-200 px-4 py-3" bind:value={noteTitle} placeholder="제목" required />
        <select class="rounded-2xl border border-slate-200 px-4 py-3" bind:value={noteGameRecordId}>
          <option value="">대국 기록 연결 없음</option>
          {#each gameRecords as record}
            <option value={record.id}>{record.mode} · {record.tableName ?? new Date(record.startedAt).toLocaleDateString()}</option>
          {/each}
        </select>
        <textarea class="min-h-28 rounded-2xl border border-slate-200 px-4 py-3" bind:value={noteBody} placeholder="복기 메모" required></textarea>
        <button class="rounded-2xl bg-pink-500 px-5 py-3 font-semibold text-white hover:bg-pink-600">저장</button>
      </form>
      <div class="mt-5 divide-y divide-slate-100">
        {#each notes as note}
          <article class="flex items-start justify-between gap-4 py-3">
            <div>
              <p class="font-semibold text-slate-900">{note.title}</p>
              <p class="mt-1 line-clamp-2 text-sm text-slate-500">{note.body}</p>
            </div>
            <button class="text-sm font-semibold text-rose-600" onclick={() => removeItem(() => api.deleteNote(note.id), "메모를 삭제했습니다.")}>삭제</button>
          </article>
        {:else}
          <p class="py-4 text-sm text-slate-500">대국 메모가 없습니다.</p>
        {/each}
      </div>
    </section>
  </div>

  {#if loading}
    <p class="mt-8 rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-slate-500 shadow-sm">개인 데이터를 불러오는 중입니다...</p>
  {/if}
</section>
