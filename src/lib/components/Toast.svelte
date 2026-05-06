<script lang="ts">
  type Tone = "success" | "error" | "info";

  let {
    message = "",
    tone = "info",
    class: className = "",
  }: {
    message?: string;
    tone?: Tone;
    class?: string;
  } = $props();

  const toneClass: Record<Tone, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-rose-200 bg-rose-50 text-rose-800",
    info: "border-brand-200 bg-brand-50 text-brand-800",
  };
</script>

{#if message}
  <p class={`rounded-2xl border px-4 py-3 text-sm font-bold shadow-soft ${toneClass[tone]} ${className}`} role={tone === "error" ? "alert" : "status"}>
    {message}
  </p>
{/if}
