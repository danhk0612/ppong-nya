<svelte:head>
  <title>로그인 | ppong-nya</title>
  <meta name="description" content="Google OAuth로 ppong-nya에 로그인합니다." />
</svelte:head>

<section class="mx-auto flex max-w-3xl flex-col items-center px-6 py-20 text-center">
  <p class="mb-5 inline-flex rounded-full border border-pink-200 bg-white px-4 py-2 text-sm font-semibold text-pink-700 shadow-sm">
    Google OAuth 로그인
  </p>
  <h1 class="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">ppong-nya 계정으로 시작하기</h1>
  <p class="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
    Google 계정으로 로그인하면 MariaDB에 사용자와 OAuth 계정 정보가 저장되고, 전적 저장 및 계정 관리 기능을 사용할 수 있습니다.
  </p>

  <div class="mt-10 rounded-[2rem] border border-white/70 bg-white p-8 shadow-xl shadow-slate-200">
    <a
      class="inline-flex items-center justify-center gap-3 rounded-full bg-slate-950 px-7 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2"
      href="/auth/signin/google?callbackUrl=/account"
    >
      <span class="grid h-6 w-6 place-items-center rounded-full bg-white text-sm font-black text-slate-950">G</span>
      Google로 로그인
    </a>
    <p class="mt-5 text-sm leading-6 text-slate-500">
      OAuth 클라이언트에는 <code class="rounded bg-slate-100 px-1.5 py-0.5">GOOGLE_CLIENT_ID</code>와
      <code class="rounded bg-slate-100 px-1.5 py-0.5">GOOGLE_CLIENT_SECRET</code> 환경 변수를 사용합니다.
    </p>
  </div>
</section>
