<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "primary" | "secondary" | "ghost" | "danger";
  type Size = "sm" | "md" | "lg";

  let {
    variant = "primary",
    size = "md",
    type = "button",
    href,
    disabled = false,
    class: className = "",
    children,
    ...rest
  }: {
    variant?: Variant;
    size?: Size;
    type?: "button" | "submit" | "reset";
    href?: string;
    disabled?: boolean;
    class?: string;
    children?: Snippet;
    [key: string]: unknown;
  } = $props();

  const variantClass: Record<Variant, string> = {
    primary: "bg-brand-500 text-white shadow-brand hover:bg-brand-600 focus-visible:ring-brand-300",
    secondary: "border border-brand-100 bg-white text-ink-700 shadow-soft hover:border-brand-200 hover:text-brand-700 focus-visible:ring-brand-200",
    ghost: "bg-transparent text-ink-600 hover:bg-brand-50 hover:text-brand-700 focus-visible:ring-brand-200",
    danger: "bg-rose-500 text-white shadow-soft hover:bg-rose-600 focus-visible:ring-rose-200",
  };

  const sizeClass: Record<Size, string> = {
    sm: "min-h-9 px-3 text-sm",
    md: "min-h-11 px-5 text-sm",
    lg: "min-h-12 px-6 text-base",
  };

  const baseClass =
    "inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50";
</script>

{#if href}
  <a class={`${baseClass} ${variantClass[variant]} ${sizeClass[size]} ${className}`} href={href} aria-disabled={disabled} {...rest}>
    {@render children?.()}
  </a>
{:else}
  <button class={`${baseClass} ${variantClass[variant]} ${sizeClass[size]} ${className}`} {type} {disabled} {...rest}>
    {@render children?.()}
  </button>
{/if}
