<script lang="ts">
  import { signOut } from "@auth/sveltekit/client";
  import type { Session } from "@auth/sveltekit";
  import { ko } from "$lib/i18n";

  let { session }: { session: Session | null } = $props();

  const fallbackInitial = $derived(session?.user?.email?.slice(0, 1).toUpperCase() ?? "?");
</script>

{#if session?.user}
  <div class="flex items-center gap-3">
    <a
      class="hidden items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-pink-200 hover:text-pink-600 sm:flex"
      href="/account"
    >
      {#if session.user.image}
        <img class="h-8 w-8 rounded-full object-cover" src={session.user.image} alt={ko.nav.userImageAlt} referrerpolicy="no-referrer" />
      {:else}
        <span class="grid h-8 w-8 place-items-center rounded-full bg-pink-100 text-pink-700">{fallbackInitial}</span>
      {/if}
      <span class="max-w-32 truncate">{session.user.name ?? session.user.email ?? ko.nav.account}</span>
    </a>

    <button
      class="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2"
      type="button"
      aria-label={ko.nav.logout}
      onclick={() => signOut({ callbackUrl: "/" })}
    >
      {ko.nav.logout}
    </button>
  </div>
{:else}
  <a
    class="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2"
    href="/login"
    aria-label={ko.nav.login}
  >
    {ko.nav.login}
  </a>
{/if}
