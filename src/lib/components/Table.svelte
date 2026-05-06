<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    caption,
    headers = [],
    class: className = "",
    children,
  }: {
    caption?: string;
    headers?: string[];
    class?: string;
    children?: Snippet;
  } = $props();
</script>

<div class={`overflow-hidden rounded-card border border-ink-100 bg-white shadow-soft ${className}`}>
  <div class="overflow-x-auto">
    <table class="min-w-full divide-y divide-ink-100 text-left text-sm">
      {#if caption}
        <caption class="sr-only">{caption}</caption>
      {/if}
      {#if headers.length}
        <thead class="bg-cream-100 text-xs font-black uppercase tracking-[0.18em] text-ink-500">
          <tr>
            {#each headers as header}
              <th class="whitespace-nowrap px-4 py-3" scope="col">{header}</th>
            {/each}
          </tr>
        </thead>
      {/if}
      <tbody class="divide-y divide-ink-100 text-ink-700">
        {@render children?.()}
      </tbody>
    </table>
  </div>
</div>
