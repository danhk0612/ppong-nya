<script lang="ts">
  let { data } = $props();
  const user = data.user;
</script>

<svelte:head>
  <title>계정 관리 | ppong-nya</title>
  <meta name="description" content="ppong-nya 로그인 계정과 세션 정보를 확인합니다." />
</svelte:head>

<section class="mx-auto max-w-4xl px-6 py-16">
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
        <p class="text-sm font-semibold text-pink-600">로그인된 계정</p>
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

    <div class="mt-10 flex flex-col gap-3 sm:flex-row">
      <a class="rounded-full bg-pink-500 px-6 py-3 text-center font-semibold text-white transition hover:bg-pink-600" href="/api/auth/session">
        세션 API 확인
      </a>
      <a class="rounded-full border border-slate-200 px-6 py-3 text-center font-semibold text-slate-700 transition hover:border-pink-200 hover:text-pink-600" href="/">
        홈으로 돌아가기
      </a>
    </div>
  </div>
</section>
