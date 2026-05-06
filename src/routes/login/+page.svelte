<script lang="ts">
  import Button from "$lib/components/Button.svelte";
  import Card from "$lib/components/Card.svelte";
  import { ko } from "$lib/i18n";
</script>

<svelte:head>
  <title>{ko.login.title}</title>
  <meta name="description" content={ko.login.description} />
</svelte:head>

<section class="mx-auto grid min-h-[calc(100vh-8rem)] max-w-5xl items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
  <div class="text-center lg:text-left">
    <p class="inline-flex rounded-pill border border-brand-200 bg-white/80 px-4 py-2 text-sm font-black text-brand-700 shadow-soft">
      {ko.login.eyebrow}
    </p>
    <h1 class="mt-6 text-4xl font-black tracking-tight text-ink-950 sm:text-5xl">{ko.login.heading}</h1>
    <p class="mt-5 text-base leading-8 text-ink-600 sm:text-lg">
      {ko.login.body}
    </p>
  </div>

  <Card class="mx-auto w-full max-w-md text-center" title={ko.login.googleCta} eyebrow="OAuth">
    <a
      class="mx-auto inline-flex min-h-12 items-center justify-center gap-3 rounded-2xl bg-ink-950 px-6 text-base font-black text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
      href="/auth/signin/google?callbackUrl=/account"
      aria-label={ko.login.googleCtaLabel}
    >
      <span class="grid h-7 w-7 place-items-center rounded-full bg-white text-sm font-black text-ink-950" aria-hidden="true">G</span>
      {ko.login.googleCta}
    </a>
    <p class="mt-5 text-sm leading-6 text-ink-500">
      OAuth 클라이언트에는 <code class="rounded bg-ink-100 px-1.5 py-0.5">GOOGLE_CLIENT_ID</code>와
      <code class="rounded bg-ink-100 px-1.5 py-0.5">GOOGLE_CLIENT_SECRET</code> 환경 변수를 사용합니다.
    </p>
    <Button class="mt-5 w-full" variant="secondary" href="/records">대국 목록 먼저 보기</Button>
  </Card>
</section>
