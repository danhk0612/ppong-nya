<script lang="ts">
  import "../app.css";
  import Navbar from "$lib/components/Navbar.svelte";
  import { ko } from "$lib/i18n";

  let { data, children } = $props();
</script>

<svelte:head>
  <title>{ko.app.title}</title>
  <meta name="description" content={ko.app.description} />
</svelte:head>

<div class="min-h-screen bg-brand-radial text-ink-950">
  <Navbar session={data.session} />

  <main>
    {@render children?.()}
  </main>
</div>
