<script lang="ts">
  let {
    value = $bindable(""),
    type = "text",
    label,
    hint,
    error,
    class: className = "",
    ...rest
  }: {
    value?: string | number;
    type?: string;
    label?: string;
    hint?: string;
    error?: string;
    class?: string;
    [key: string]: unknown;
  } = $props();
</script>

<label class={`grid gap-2 text-sm font-semibold text-ink-700 ${className}`}>
  {#if label}
    <span>{label}</span>
  {/if}
  <input
    class="min-h-12 w-full rounded-2xl border border-ink-200 bg-white px-4 py-3 text-base text-ink-950 outline-none transition placeholder:text-ink-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
    bind:value
    {type}
    aria-invalid={error ? "true" : undefined}
    {...rest}
  />
  {#if error || hint}
    <span class={error ? "text-xs font-semibold text-rose-600" : "text-xs text-ink-500"}>{error ?? hint}</span>
  {/if}
</label>
