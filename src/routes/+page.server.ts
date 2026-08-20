import { db } from "$lib/server/db";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const session = await event.locals.auth();

  if (!session?.user?.id) {
    return { favorites: [] };
  }

  const favorites = await db.favoritePlayer.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 6,
    select: {
      id: true,
      playerId: true,
      nickname: true,
    },
  });

  return { favorites };
};
