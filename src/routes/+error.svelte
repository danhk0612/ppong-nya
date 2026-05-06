<script lang="ts">
  import { page } from "$app/state";
  import Button from "$lib/components/Button.svelte";
  import Card from "$lib/components/Card.svelte";
  import StatusBlock from "$lib/components/StatusBlock.svelte";
  import { ko } from "$lib/i18n";
</script>

<svelte:head>
  <title>{ko.error.title}</title>
</svelte:head>

<section class="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
  <Card>
    <StatusBlock tone="error" title={ko.error.heading} description={page.error?.message ?? ko.error.fallbackMessage} />
    <p class="mt-5 text-sm font-black text-rose-700">{page.status || ko.error.unknownStatus}</p>
    <Button class="mt-6" href="/" aria-label={ko.error.homeCta}>{ko.error.homeCta}</Button>
  </Card>
</section>
