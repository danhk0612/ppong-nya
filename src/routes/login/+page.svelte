<script lang="ts">
  import Button from "$lib/components/Button.svelte";
  import Card from "$lib/components/Card.svelte";
  import Input from "$lib/components/Input.svelte";
  import Toast from "$lib/components/Toast.svelte";
  import { ko } from "$lib/i18n";

  type AuthMode = "login" | "signup";

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
      errorMessage =
        error instanceof Error
          ? error.message
          : "이메일 인증을 처리하지 못했습니다.";
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>{ko.login.title}</title>
  <meta name="description" content={ko.login.description} />
</svelte:head>

<section class="mx-auto grid min-h-[calc(100vh-8rem)] max-w-4xl items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
  <div class="text-center lg:text-left">
    <p class="inline-flex rounded-pill border border-brand-200 bg-white/80 px-4 py-2 text-sm font-black text-brand-700 shadow-soft">
      {ko.login.eyebrow}
    </p>
    <h1 class="mt-6 text-4xl font-black tracking-tight text-ink-950 sm:text-5xl">
      {ko.login.heading}
    </h1>
    <p class="mt-5 text-base leading-8 text-ink-600 sm:text-lg">
      {ko.login.body}
    </p>
  </div>

  <Card
    class="mx-auto w-full max-w-md"
    title={mode === "login" ? "이메일 로그인" : "이메일 회원가입"}
  >
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
        회원가입
      </button>
    </div>

    <form
      class="mt-5 grid gap-4"
      onsubmit={(event) => {
        event.preventDefault();
        void submitEmailAuth();
      }}
    >
      {#if mode === "signup"}
        <Input
          bind:value={name}
          label="이름"
          autocomplete="name"
          placeholder="표시 이름(선택)"
        />
      {/if}
      <Input
        bind:value={email}
        type="email"
        label="이메일 아이디"
        autocomplete="email"
        placeholder="you@example.com"
        required
      />
      <Input
        bind:value={password}
        type="password"
        label="비밀번호"
        autocomplete={mode === "login" ? "current-password" : "new-password"}
        placeholder="영문자와 숫자 포함 8자 이상"
        required
      />
      <Button class="w-full" type="submit" disabled={loading}>
        {loading
          ? "처리 중..."
          : mode === "login"
            ? "로그인"
            : "회원가입"}
      </Button>
    </form>
    <Toast class="mt-4" message={errorMessage} tone="error" />
  </Card>
</section>
