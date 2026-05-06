<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    value = $bindable(""),
    label,
    hint,
    error,
    class: className = "",
    children,
    ...rest
  }: {
    value?: string;
    label?: string;
    hint?: string;
    error?: string;
    class?: string;
    children?: Snippet;
    [key: string]: unknown;
  } = $props();
</script>

<label class={`grid gap-2 text-sm font-semibold text-ink-700 ${className}`}>
  {#if label}
    <span>{label}</span>
  {/if}
  <select
    class="min-h-12 w-full rounded-2xl border border-ink-200 bg-white px-4 py-3 text-base text-ink-950 outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
    bind:value
    aria-invalid={error ? "true" : undefined}
    {...rest}
  >
    {@render children?.()}
  </select>
  {#if error || hint}
    <span class={error ? "text-xs font-semibold text-rose-600" : "text-xs text-ink-500"}>{error ?? hint}</span>
  {/if}
</label>
