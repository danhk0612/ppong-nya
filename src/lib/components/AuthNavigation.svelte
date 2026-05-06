<script lang="ts">
  import type { Session } from "@auth/sveltekit";
  import Button from "./Button.svelte";
  import { ko } from "$lib/i18n";

  let { session }: { session: Session | null } = $props();

  const fallbackInitial = $derived(session?.user?.email?.slice(0, 1).toUpperCase() ?? "?");

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }
</script>

{#if session?.user}
  <div class="flex shrink-0 items-center gap-2 sm:gap-3">
    <a
      class="hidden items-center gap-3 rounded-pill border border-white bg-white/85 px-3 py-2 text-sm font-bold text-ink-700 shadow-soft transition hover:-translate-y-0.5 hover:text-brand-700 sm:flex"
      href="/account"
    >
      {#if session.user.image}
        <img class="h-8 w-8 rounded-full object-cover" src={session.user.image} alt={ko.nav.userImageAlt} referrerpolicy="no-referrer" />
      {:else}
        <span class="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-brand-700">{fallbackInitial}</span>
      {/if}
      <span class="max-w-28 truncate lg:max-w-40">{session.user.name ?? session.user.email ?? ko.nav.account}</span>
    </a>

    <Button size="sm" aria-label={ko.nav.logout} onclick={() => void logout()}>
      {ko.nav.logout}
    </Button>
  </div>
{:else}
  <Button size="sm" href="/login" aria-label={ko.nav.login}>
    {ko.nav.login}
  </Button>
{/if}
