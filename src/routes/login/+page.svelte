<script lang="ts">
  import Button from "$lib/components/Button.svelte";
  import Card from "$lib/components/Card.svelte";
  import Input from "$lib/components/Input.svelte";
  import Toast from "$lib/components/Toast.svelte";
  import { ko } from "$lib/i18n";

  type AuthMode = "login" | "signup";

  let { data } = $props();

  let mode = $state<AuthMode>("login");
  let email = $state("");
  let name = $state("");
  let password = $state("");
  let loading = $state(false);
  let errorMessage = $state("");

  async function submitEmailAuth() {
    loading = true;
    errorMessage = "";

    try {
      const response = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, email, name, password }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => undefined);
        throw new Error(payload?.message ?? "이메일 인증을 처리하지 못했습니다.");
      }

      window.location.href = "/account";
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "이메일 인증을 처리하지 못했습니다.";
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>{ko.login.title}</title>
  <meta name="description" content={ko.login.description} />
</svelte:head>

<section class="mx-auto grid min-h-[calc(100vh-8rem)] max-w-5xl items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
  <div class="text-center lg:text-left">
    <p class="inline-flex rounded-pill border border-brand-200 bg-white/80 px-4 py-2 text-sm font-black text-brand-700 shadow-soft">
      이메일 또는 Google 로그인
    </p>
    <h1 class="mt-6 text-4xl font-black tracking-tight text-ink-950 sm:text-5xl">{ko.login.heading}</h1>
    <p class="mt-5 text-base leading-8 text-ink-600 sm:text-lg">
      이메일과 비밀번호로 바로 가입하거나 기존 Google 계정으로 로그인해 전적 저장 및 계정 관리 기능을 사용할 수 있습니다.
    </p>
  </div>

  <div class="mx-auto grid w-full max-w-md gap-5">
    <Card title={mode === "login" ? "이메일 로그인" : "이메일 회원가입"} eyebrow="Email">
      <div class="grid grid-cols-2 gap-2 rounded-2xl bg-ink-100 p-1">
        <button
          class={`rounded-xl px-4 py-2 text-sm font-black transition ${mode === "login" ? "bg-white text-brand-700 shadow-soft" : "text-ink-500"}`}
          type="button"
          onclick={() => (mode = "login")}
        >
          로그인
        </button>
        <button
          class={`rounded-xl px-4 py-2 text-sm font-black transition ${mode === "signup" ? "bg-white text-brand-700 shadow-soft" : "text-ink-500"}`}
          type="button"
          onclick={() => (mode = "signup")}
        >
          가입
        </button>
      </div>

      <form class="mt-5 grid gap-4" onsubmit={(event) => { event.preventDefault(); void submitEmailAuth(); }}>
        {#if mode === "signup"}
          <Input bind:value={name} label="이름" autocomplete="name" placeholder="표시 이름(선택)" />
        {/if}
        <Input bind:value={email} type="email" label="이메일 아이디" autocomplete="email" placeholder="you@example.com" required />
        <Input bind:value={password} type="password" label="비밀번호" autocomplete={mode === "login" ? "current-password" : "new-password"} placeholder="영문자와 숫자 포함 8자 이상" required />
        <Button class="w-full" type="submit" disabled={loading}>{loading ? "처리 중..." : mode === "login" ? "이메일로 로그인" : "이메일로 가입"}</Button>
      </form>
      <Toast class="mt-4" message={errorMessage} tone="error" />
      <p class="mt-4 text-xs leading-5 text-ink-500">
        기본 관리자 계정은 <code class="rounded bg-ink-100 px-1.5 py-0.5">DEFAULT_ADMIN_EMAIL</code> / <code class="rounded bg-ink-100 px-1.5 py-0.5">DEFAULT_ADMIN_PASSWORD</code> 환경 변수로 지정할 수 있으며, 최초 로그인 후 이메일 아이디와 비밀번호 변경이 필수입니다.
      </p>
    </Card>

    {#if data.googleEnabled}
      <Card class="text-center" title={ko.login.googleCta} eyebrow="OAuth">
      <a
        class="mx-auto inline-flex min-h-12 items-center justify-center gap-3 rounded-2xl bg-ink-950 px-6 text-base font-black text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
        href="/auth/signin/google?callbackUrl=/account"
        aria-label={ko.login.googleCtaLabel}
      >
        <span class="grid h-7 w-7 place-items-center rounded-full bg-white text-sm font-black text-ink-950" aria-hidden="true">G</span>
        {ko.login.googleCta}
      </a>
      <p class="mt-5 text-sm leading-6 text-ink-500">{ko.login.envNotice}</p>
        <Button class="mt-5 w-full" variant="secondary" href="/records">대국 목록 먼저 보기</Button>
      </Card>
    {:else}
      <Button class="w-full" variant="secondary" href="/records">대국 목록 먼저 보기</Button>
    {/if}
  </div>
</section>
