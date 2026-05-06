<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    label,
    value,
    monospace = false,
    class: className = "",
    children,
  }: {
    label: string;
    value?: string | number | null;
    monospace?: boolean;
    class?: string;
    children?: Snippet;
  } = $props();
</script>

<div class={`rounded-3xl bg-cream-100 p-5 ${className}`}>
  <dt class="text-sm font-black text-ink-500">{label}</dt>
  <dd class={`mt-2 break-words text-ink-900 ${monospace ? "font-mono text-sm" : "text-xl font-black"}`}>
    {#if children}
      {@render children()}
    {:else}
      {value ?? "-"}
    {/if}
  </dd>
</div>
