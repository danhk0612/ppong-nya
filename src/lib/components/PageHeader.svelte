<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    eyebrow,
    title,
    description,
    align = "left",
    class: className = "",
    actions,
  }: {
    eyebrow?: string;
    title: string;
    description?: string;
    align?: "left" | "center";
    class?: string;
    actions?: Snippet;
  } = $props();

  const alignClass = $derived(align === "center" ? "text-center" : "text-left");
</script>

<div class={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
  <div class={alignClass}>
    {#if eyebrow}
      <p class="text-sm font-black text-brand-600">{eyebrow}</p>
    {/if}
    <h1 class="mt-2 text-4xl font-black tracking-tight text-ink-950 sm:text-5xl">{title}</h1>
    {#if description}
      <p class="mt-3 max-w-2xl text-sm leading-6 text-ink-600 sm:text-base">{description}</p>
    {/if}
  </div>
  {#if actions}
    <div class="flex shrink-0 flex-col gap-2 xs:flex-row sm:justify-end">
      {@render actions()}
    </div>
  {/if}
</div>
