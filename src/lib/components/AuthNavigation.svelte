<script lang="ts">
  import { signOut } from "@auth/sveltekit/client";
  import type { Session } from "@auth/sveltekit";

  let { session }: { session: Session | null } = $props();

  const fallbackInitial = session?.user?.email?.slice(0, 1).toUpperCase() ?? "?";
</script>

{#if session?.user}
  <div class="flex items-center gap-3">
    <a
      class="hidden items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-pink-200 hover:text-pink-600 sm:flex"
      href="/account"
    >
      {#if session.user.image}
        <img class="h-8 w-8 rounded-full object-cover" src={session.user.image} alt="" referrerpolicy="no-referrer" />
      {:else}
        <span class="grid h-8 w-8 place-items-center rounded-full bg-pink-100 text-pink-700">{fallbackInitial}</span>
      {/if}
      <span class="max-w-32 truncate">{session.user.name ?? session.user.email ?? "계정"}</span>
    </a>

    <button
      class="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2"
      type="button"
      onclick={() => signOut({ callbackUrl: "/" })}
    >
      로그아웃
    </button>
  </div>
{:else}
  <a
    class="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2"
    href="/login"
  >
    로그인
  </a>
{/if}
