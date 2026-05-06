<script lang="ts">
  import type { Snippet } from "svelte";

  type PageSectionSize = "wide" | "content" | "narrow";

  let {
    size = "wide",
    class: className = "",
    children,
  }: {
    size?: PageSectionSize;
    class?: string;
    children?: Snippet;
  } = $props();

  const sizeClass: Record<PageSectionSize, string> = {
    wide: "max-w-7xl",
    content: "max-w-5xl",
    narrow: "max-w-3xl",
  };
</script>

<section class={`mx-auto ${sizeClass[size]} px-4 py-10 sm:px-6 sm:py-14 lg:px-8 ${className}`}>
  {@render children?.()}
</section>
