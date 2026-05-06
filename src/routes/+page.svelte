<script lang="ts">
  import Button from "$lib/components/Button.svelte";
  import Card from "$lib/components/Card.svelte";
  import StatusBlock from "$lib/components/StatusBlock.svelte";
  import { ko } from "$lib/i18n";

  const highlights = ko.home.highlights;
</script>

<section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:grid lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:px-8 lg:py-24">
  <div>
    <p class="inline-flex rounded-pill border border-brand-200 bg-white/80 px-4 py-2 text-sm font-black text-brand-700 shadow-soft">
      {ko.home.eyebrow}
    </p>
    <h1 class="mt-6 max-w-4xl font-display text-hero font-black text-ink-950">
      {ko.home.title}
    </h1>
    <p class="mt-6 max-w-2xl text-base leading-8 text-ink-600 sm:text-lg">
      {ko.home.description}
    </p>
    <div class="mt-8 grid gap-3 xs:grid-cols-2 sm:flex">
      <Button href="/login" size="lg" aria-label={ko.login.googleCtaLabel}>{ko.home.loginCta}</Button>
      <Button href="/records" variant="secondary" size="lg">{ko.home.exploreCta}</Button>
    </div>
  </div>

  <Card class="mt-10 p-3 lg:mt-0" padded={false}>
    <div class="rounded-[1.5rem] bg-ink-950 p-5 text-white sm:p-6">
      <div class="flex flex-col gap-3 border-b border-white/10 pb-5 xs:flex-row xs:items-center xs:justify-between">
        <div>
          <p class="text-sm font-bold text-brand-200">{ko.home.dashboardEyebrow}</p>
          <p class="mt-1 text-2xl font-black">{ko.home.dashboardTitle}</p>
        </div>
        <span class="w-fit rounded-pill bg-brand-500 px-3 py-1 text-sm font-black shadow-brand">{ko.home.betaBadge}</span>
      </div>
      <div class="mt-5 grid gap-3 sm:grid-cols-2">
        {#each highlights as item}
          <a id={item.id} class="block rounded-3xl bg-white/10 p-4 transition hover:-translate-y-0.5 hover:bg-white/15" href={item.id === "records" ? "/records" : `#${item.id}`}>
            <p class="font-black text-white">{item.label}</p>
            <p class="mt-2 text-sm leading-6 text-ink-300">{item.description}</p>
          </a>
        {/each}
      </div>
    </div>
  </Card>
</section>

<section class="mx-auto grid max-w-7xl gap-4 px-4 pb-16 sm:px-6 lg:grid-cols-3 lg:px-8">
  <StatusBlock title="공통 상태" description="빈 화면, 로딩, 오류 상태를 같은 컴포넌트와 톤으로 표현해 화면 간 피드백을 통일합니다." />
  <StatusBlock tone="loading" title="모바일 우선" description="작은 화면에서 먼저 읽기 편한 단일 컬럼을 만들고, 넓은 화면에서 카드와 표를 확장합니다." />
  <StatusBlock tone="empty" title="브랜드 토큰" description="Tailwind 테마에 퐁냐 색상, 여백, 타이포그래피 기준을 정의했습니다." />
</section>
