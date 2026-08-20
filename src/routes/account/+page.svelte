<script lang="ts">
  import { onMount } from "svelte";
  import Button from "$lib/components/Button.svelte";
  import Card from "$lib/components/Card.svelte";
  import Input from "$lib/components/Input.svelte";
  import PageSection from "$lib/components/PageSection.svelte";
  import StatusBlock from "$lib/components/StatusBlock.svelte";
  import Toast from "$lib/components/Toast.svelte";
  import { syncFavoritePlayer } from "$lib/favoriteSync";
  import {
    createUserDataApi,
    type FavoritePlayerItem,
  } from "$lib/stores/userData";
  import { formatDateTime, ko } from "$lib/i18n";
  import { LevelWithDelta } from "../../data/types/level";

  let { data } = $props();

  function initialCredentialEmail() {
    return data.user.email ?? "";
  }

  function initialCredentialName() {
    return data.user.name ?? "";
  }

  const api = createUserDataApi();
  const user = $derived(data.user);

  let favorites = $state<FavoritePlayerItem[]>([]);
  let favoritesLoading = $state(true);
  let actionLoading = $state(false);
  let message = $state("");
  let errorMessage = $state("");
  let credentialEmail = $state(initialCredentialEmail());
  let credentialName = $state(initialCredentialName());
  let currentPassword = $state("");
  let newPassword = $state("");

  async function loadFavorites() {
    favoritesLoading = true;
    errorMessage = "";

    try {
      favorites = await api.listFavorites();
      void refreshFavoriteData(favorites);
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : ko.account.unknownDataError;
    } finally {
      favoritesLoading = false;
    }
  }

  async function refreshFavoriteData(items: FavoritePlayerItem[]) {
    for (const favorite of items) {
      try {
        await syncFavoritePlayer(favorite.playerId);
      } catch {
        // A later favorite-list or player-page visit retries stale data.
      }
    }

    favorites = await api.listFavorites().catch(() => favorites);
  }

  function currentLevelLabel(favorite: FavoritePlayerItem) {
    return favorite.currentLevel
      ? LevelWithDelta.getTag(favorite.currentLevel)
      : "등급 정보 없음";
  }

  async function submitCredentialChange() {
    actionLoading = true;
    message = "";
    errorMessage = "";

    try {
      const response = await fetch("/api/account/credentials", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: credentialEmail,
          name: credentialName,
          currentPassword,
          newPassword,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => undefined);
        throw new Error(payload?.message ?? "계정 정보를 변경하지 못했습니다.");
      }

      currentPassword = "";
      newPassword = "";
      message = "이름, 이메일 아이디와 비밀번호를 변경했습니다.";
    } catch (error) {
      errorMessage =
        error instanceof Error
          ? error.message
          : ko.account.unknownRequestError;
    } finally {
      actionLoading = false;
    }
  }

  async function removeFavorite(id: string) {
    actionLoading = true;
    message = "";
    errorMessage = "";

    try {
      await api.deleteFavorite(id);
      favorites = favorites.filter((favorite) => favorite.id !== id);
      message = ko.account.messages.favoriteDeleted;
    } catch (error) {
      errorMessage =
        error instanceof Error
          ? error.message
          : ko.account.unknownRequestError;
    } finally {
      actionLoading = false;
    }
  }

  async function logout() {
    actionLoading = true;
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  onMount(() => {
    void loadFavorites();
  });
</script>

<svelte:head>
  <title>{ko.account.title}</title>
  <meta name="description" content={ko.account.description} />
</svelte:head>

<PageSection size="content">
  <Card class="overflow-hidden" padded={false}>
    <div class="bg-ink-950 p-6 text-white sm:p-8">
      <p class="text-sm font-black text-brand-200">{ko.account.providerLabel}</p>
      <h1 class="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
        {user.name ?? ko.account.unnamedUser}
      </h1>
      <p class="mt-2 break-all text-ink-300">{user.email}</p>
    </div>
  </Card>

  {#if user.passwordChangeRequired}
    <Card
      class="mt-6 border-rose-200 bg-rose-50/80"
      title="처음 로그인한 계정의 정보 변경"
    >
      <p class="text-sm leading-6 text-rose-700">
        계속 사용하려면 이메일 아이디와 비밀번호를 새 값으로 변경해 주세요.
      </p>
    </Card>
  {/if}

  <Card class="mt-6" title="계정 정보 변경">
    <form
      class="grid gap-4 sm:grid-cols-2"
      onsubmit={(event) => {
        event.preventDefault();
        void submitCredentialChange();
      }}
    >
      <Input
        bind:value={credentialName}
        label="이름"
        autocomplete="name"
        placeholder="표시 이름"
      />
      <Input
        bind:value={credentialEmail}
        type="email"
        label="이메일 아이디"
        autocomplete="email"
        required
      />
      {#if !user.passwordChangeRequired}
        <Input
          bind:value={currentPassword}
          type="password"
          label="현재 비밀번호"
          autocomplete="current-password"
          required
        />
      {/if}
      <Input
        bind:value={newPassword}
        type="password"
        label="새 비밀번호"
        autocomplete="new-password"
        placeholder="영문자와 숫자 포함 8자 이상"
        required
      />
      <div class="sm:col-span-2">
        <Button type="submit" disabled={actionLoading}>
          {actionLoading ? "처리 중..." : "변경하기"}
        </Button>
      </div>
    </form>
  </Card>

  <section class="mt-10" aria-labelledby="favorite-heading">
    <div class="flex items-end justify-between gap-4">
      <div>
        <p class="text-sm font-black text-brand-600">내 플레이어</p>
        <h2 id="favorite-heading" class="mt-2 text-2xl font-black text-ink-950">
          즐겨찾기 플레이어
        </h2>
      </div>
      <Button href="/" variant="secondary" size="sm">플레이어 검색</Button>
    </div>

    {#if favoritesLoading}
      <StatusBlock
        class="mt-5"
        tone="loading"
        title="즐겨찾기를 불러오는 중입니다"
      />
    {:else if favorites.length}
      <div class="mt-5 divide-y divide-ink-100 rounded-3xl border border-white/80 bg-white/90 px-5 shadow-soft">
        {#each favorites as favorite (favorite.id)}
          <article
            class="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="min-w-0">
              <h3 class="truncate text-lg font-black text-ink-950">
                {favorite.nickname}
              </h3>
              <p class="mt-1 text-sm text-ink-500">
                플레이어 ID {favorite.playerId}
              </p>
              <p class="mt-2 text-sm font-bold text-ink-700">
                현재 등급 {currentLevelLabel(favorite)}
              </p>
              <p class="mt-1 text-xs text-ink-500">
                전적 최종 갱신
                {favorite.lastRefreshedAt
                  ? formatDateTime(favorite.lastRefreshedAt)
                  : "기록 없음"}
              </p>
            </div>
            <div class="flex shrink-0 flex-wrap gap-2">
              <Button href={`/player/${favorite.playerId}`} size="sm">
                전적 보기
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={actionLoading}
                onclick={() => void removeFavorite(favorite.id)}
              >
                삭제
              </Button>
            </div>
          </article>
        {/each}
      </div>
    {:else}
      <StatusBlock
        class="mt-5"
        title="즐겨찾기 플레이어가 없습니다"
        description="홈에서 플레이어를 검색한 뒤 즐겨찾기에 추가할 수 있습니다."
        actionLabel="플레이어 검색"
        actionHref="/"
      />
    {/if}
  </section>

  <Toast class="mt-6" message={message} tone="success" />
  <Toast class="mt-3" message={errorMessage} tone="error" />

  <div class="mt-10 border-t border-ink-100 pt-6">
    <Button variant="secondary" disabled={actionLoading} onclick={() => void logout()}>
      로그아웃
    </Button>
  </div>
</PageSection>
