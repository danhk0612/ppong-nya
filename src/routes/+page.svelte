<script lang="ts">
  const highlights = [
    { id: "ranking", label: "실시간 랭킹", description: "단위전과 대회 기록을 빠르게 탐색할 수 있도록 준비 중입니다." },
    { id: "records", label: "전적 검색", description: "플레이어별 경기 흐름과 최근 기록을 ppong-nya에서 이어갑니다." },
    { id: "tools", label: "분석 도구", description: "필터, 통계, 하이라이트 기능을 SvelteKit 기반으로 새롭게 구성합니다." }
  ];
</script>

<section class="relative isolate overflow-hidden">
  <div class="absolute inset-x-0 top-0 -z-10 h-96 bg-gradient-to-br from-pink-100 via-white to-sky-100"></div>
  <div class="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-28">
    <div>
      <p class="mb-5 inline-flex rounded-full border border-pink-200 bg-white/70 px-4 py-2 text-sm font-semibold text-pink-700 shadow-sm">
        SvelteKit으로 새롭게 시작하는 ppong-nya
      </p>
      <h1 class="text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">
        마작 기록을 더 가볍고 빠르게 만나는 홈 화면
      </h1>
      <p class="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
        ppong-nya는 SvelteKit 구조로 전환한 새 랜딩입니다. 랭킹, 전적, 통계 기능을 확장하기 위한 기본
        내비게이션과 로그인 진입점을 제공합니다.
      </p>
      <div class="mt-10 flex flex-col gap-3 sm:flex-row">
        <a
          class="rounded-full bg-pink-500 px-7 py-3 text-center font-semibold text-white shadow-lg shadow-pink-200 transition hover:-translate-y-0.5 hover:bg-pink-600"
          href="/login"
        >
          로그인하고 시작하기
        </a>
        <a
          class="rounded-full border border-slate-200 bg-white px-7 py-3 text-center font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-pink-200 hover:text-pink-600"
          href="#ranking"
        >
          기능 둘러보기
        </a>
      </div>
    </div>

    <div class="rounded-[2rem] border border-white/70 bg-white/75 p-6 shadow-2xl shadow-slate-200 backdrop-blur">
      <div class="rounded-[1.5rem] bg-slate-950 p-5 text-white">
        <div class="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <p class="text-sm text-pink-200">오늘의 ppong-nya</p>
            <p class="text-2xl font-bold">홈 대시보드</p>
          </div>
          <span class="rounded-full bg-pink-500 px-3 py-1 text-sm font-semibold">beta</span>
        </div>
        <div class="mt-6 grid gap-4">
          {#each highlights as item}
            <a id={item.id} class="block rounded-2xl bg-white/10 p-5 transition hover:bg-white/15" href={`#${item.id}`}>
              <p class="font-semibold text-white">{item.label}</p>
              <p class="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
            </a>
          {/each}
        </div>
      </div>
    </div>
  </div>
</section>
