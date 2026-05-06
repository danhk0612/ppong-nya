<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title,
    eyebrow,
    padded = true,
    class: className = "",
    children,
  }: {
    title?: string;
    eyebrow?: string;
    padded?: boolean;
    class?: string;
    children?: Snippet;
  } = $props();
</script>

<section class={`rounded-card border border-white/80 bg-white/90 shadow-soft backdrop-blur ${padded ? "p-5 sm:p-6" : ""} ${className}`}>
  {#if eyebrow || title}
    <div class="mb-5">
      {#if eyebrow}
        <p class="text-xs font-black uppercase tracking-[0.22em] text-brand-600">{eyebrow}</p>
      {/if}
      {#if title}
        <h2 class="mt-2 text-xl font-black tracking-tight text-ink-950">{title}</h2>
      {/if}
    </div>
  {/if}
  {@render children?.()}
</section>
