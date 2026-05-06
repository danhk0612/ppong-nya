<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    class: className = "",
    content,
    action,
  }: {
    class?: string;
    content: Snippet;
    action?: Snippet;
  } = $props();
</script>

<article class={`flex flex-col gap-3 py-4 xs:flex-row xs:items-center xs:justify-between ${className}`}>
  <div class="min-w-0">
    {@render content()}
  </div>
  {#if action}
    <div class="shrink-0">
      {@render action()}
    </div>
  {/if}
</article>
