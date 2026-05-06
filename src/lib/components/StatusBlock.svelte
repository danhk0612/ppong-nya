<script lang="ts">
  import Button from "./Button.svelte";

  type Tone = "empty" | "loading" | "error";

  let {
    tone = "empty",
    title,
    description,
    actionLabel,
    actionHref,
    class: className = "",
  }: {
    tone?: Tone;
    title: string;
    description?: string;
    actionLabel?: string;
    actionHref?: string;
    class?: string;
  } = $props();

  const icon: Record<Tone, string> = {
    empty: "猫",
    loading: "…",
    error: "!",
  };

  const toneClass: Record<Tone, string> = {
    empty: "bg-brand-50 text-brand-700",
    loading: "bg-sky-50 text-sky-700",
    error: "bg-rose-50 text-rose-700",
  };
</script>

<div class={`rounded-card border border-dashed border-ink-200 bg-white/80 p-6 text-center ${className}`}>
  <div class={`mx-auto grid h-12 w-12 place-items-center rounded-2xl text-xl font-black ${toneClass[tone]}`}>{icon[tone]}</div>
  <h3 class="mt-4 text-lg font-black text-ink-950">{title}</h3>
  {#if description}
    <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-600">{description}</p>
  {/if}
  {#if actionLabel && actionHref}
    <Button class="mt-5" href={actionHref}>{actionLabel}</Button>
  {/if}
</div>
