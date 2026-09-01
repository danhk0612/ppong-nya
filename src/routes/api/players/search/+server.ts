import { json } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  const query = url.searchParams.get("q")?.trim() ?? "";
  const requestedLimit = Number(url.searchParams.get("limit") ?? 20);
  const limit = Math.max(1, Math.min(50, Number.isFinite(requestedLimit) ? requestedLimit : 20));

  if (!query) return json([]);

  const players = await db.cachedPlayer.findMany({
    where: /^\d+$/.test(query)
      ? { playerId: query }
      : { nickname: { contains: query } },
    orderBy: [
      { latestTimestamp: "desc" },
      { lastUpdatedAt: "desc" },
    ],
    take: limit,
  });

  return json(
    players.map((player) => ({
      id: Number(player.playerId),
      nickname: player.nickname,
      level: {
        id: player.level ?? 10101,
        score: 0,
        delta: 0,
      },
      latest_timestamp:
        player.latestTimestamp == null ? 0 : Number(player.latestTimestamp),
    })),
  );
};
