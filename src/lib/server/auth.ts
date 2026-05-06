import { error, redirect, type RequestEvent } from "@sveltejs/kit";

type AuthSession = NonNullable<Awaited<ReturnType<App.Locals["auth"]>>>;
export type AuthenticatedSession = AuthSession & {
  user: NonNullable<AuthSession["user"]>;
};

export async function requireSession(
  event: RequestEvent,
  redirectTo = "/login"
) {
  const session = await event.locals.auth();

  if (!session?.user) {
    redirect(303, redirectTo);
  }

  return session as AuthenticatedSession;
}

export async function requireApiSession(event: RequestEvent) {
  const session = await event.locals.auth();

  if (!session?.user) {
    error(401, "로그인이 필요한 API입니다.");
  }

  return session as AuthenticatedSession;
}
