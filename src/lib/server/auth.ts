import type { UserRole } from "@prisma/client";
import { db } from "$lib/server/db";
import { error, redirect, type RequestEvent } from "@sveltejs/kit";

type AuthSession = NonNullable<Awaited<ReturnType<App.Locals["auth"]>>>;
export type AuthenticatedSession = AuthSession & {
  user: NonNullable<AuthSession["user"]>;
};

type ApiAuthorizationOptions = {
  role?: UserRole;
  googleAccount?: boolean;
};

async function getAuthenticatedSession(event: RequestEvent) {
  const session = await event.locals.auth();

  return session?.user ? (session as AuthenticatedSession) : undefined;
}

export async function requireSession(
  event: RequestEvent,
  redirectTo = "/login",
) {
  const session = await getAuthenticatedSession(event);

  if (!session) {
    redirect(303, redirectTo);
  }

  return session;
}

export async function requireApiSession(
  event: RequestEvent,
  options: ApiAuthorizationOptions = {},
) {
  const session = await getAuthenticatedSession(event);

  if (!session) {
    error(401, "로그인이 필요한 API입니다.");
  }

  if (options.role && session.user.role !== options.role) {
    error(403, "이 API를 사용할 권한이 없습니다.");
  }

  if (options.googleAccount) {
    const googleAccount = await db.account.findFirst({
      where: { userId: session.user.id, provider: "google" },
      select: { id: true },
    });

    if (!googleAccount) {
      error(403, "Google 로그인 세션이 필요한 API입니다.");
    }
  }

  return session;
}

export async function requireGoogleApiSession(event: RequestEvent) {
  return requireApiSession(event, { googleAccount: true });
}
