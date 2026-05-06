import { db } from "$lib/server/db";
import { requireSession } from "$lib/server/auth";
import { getAuthSessionToken } from "$lib/server/sessionToken";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const session = await requireSession(event);
  const sessionToken = getAuthSessionToken(event.cookies);

  const [accounts, databaseSession] = await Promise.all([
    db.account.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        provider: true,
        type: true,
        providerAccountId: true,
        scope: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    sessionToken
      ? db.session.findUnique({
          where: { sessionToken },
          select: {
            id: true,
            expires: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      : Promise.resolve(null),
  ]);

  return { session, user: session.user, accounts, databaseSession };
};
