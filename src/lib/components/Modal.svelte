<script lang="ts">
  import type { Snippet } from "svelte";
  import Button from "./Button.svelte";

  let {
    open = $bindable(false),
    title,
    description,
    closeLabel = "닫기",
    children,
  }: {
    open?: boolean;
    title?: string;
    description?: string;
    closeLabel?: string;
    children?: Snippet;
  } = $props();
</script>

{#if open}
  <div class="fixed inset-0 z-50 grid place-items-end p-3 sm:place-items-center">
    <button class="absolute inset-0 bg-ink-950/45 backdrop-blur-sm" type="button" aria-label={closeLabel} onclick={() => (open = false)}></button>
    <div class="relative max-h-[90vh] w-full max-w-lg overflow-auto rounded-card bg-white p-5 shadow-2xl sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div class="flex items-start justify-between gap-4">
        <div>
          {#if title}
            <h2 class="text-xl font-black tracking-tight text-ink-950">{title}</h2>
          {/if}
          {#if description}
            <p class="mt-2 text-sm leading-6 text-ink-600">{description}</p>
          {/if}
        </div>
        <Button variant="ghost" size="sm" aria-label={closeLabel} onclick={() => (open = false)}>✕</Button>
      </div>
      <div class="mt-5">
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}
