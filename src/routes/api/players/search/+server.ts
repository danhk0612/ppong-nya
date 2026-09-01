import { env } from "$env/dynamic/private";
import { json } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import type { RequestHandler } from "./$types";

const DEFAULT_COLLECTOR_URL = "http://collector:3001";

type NativeSearchPlayer = {
  accountId: number;
  nickname: string;
  level?: { id?: number; score?: number } | null;
  level3?: { id?: number; score?: number } | null;
};

function mapPlayer(player: {
  playerId: string;
  nickname: string;
  level: number | null;
  latestTimestamp: bigint | null;
}) {
  return {
    id: Number(player.playerId),
    nickname: player.nickname,
    level: {
      id: player.level ?? 10101,
      score: 0,
      delta: 0,
    },
    latest_timestamp:
      player.latestTimestamp == null ? 0 : Number(player.latestTimestamp),
  };
}

async function findLocalPlayers(query: string, limit: number) {
  return db.cachedPlayer.findMany({
    where: /^\d+$/.test(query)
      ? { playerId: query }
      : { nickname: { contains: query } },
    orderBy: [
      { latestTimestamp: "desc" },
      { lastUpdatedAt: "desc" },
    ],
    take: limit,
  });
}

async function searchNativeCollector(query: string, limit: number) {
  const base = (env.NATIVE_COLLECTOR_URL || DEFAULT_COLLECTOR_URL).replace(/\/$/, "");
  const url = new URL(`${base}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(`native collector search failed: HTTP ${response.status}`);
  }
  return (await response.json()) as NativeSearchPlayer[];
}

async function cacheNativePlayers(players: NativeSearchPlayer[]) {
  const now = new Date();
  await Promise.all(
    players
      .filter((player) => Number.isInteger(player.accountId) && player.accountId > 0 && player.nickname)
      .map((player) => {
        const playerId = String(player.accountId);
        const level = Number(player.level?.id || 0) || null;
        return db.cachedPlayer.upsert({
          where: { playerId },
          create: {
            playerId,
            nickname: player.nickname,
            level,
            maxLevel: level,
            lastUpdatedAt: now,
          },
          update: {
            nickname: player.nickname,
            level,
            lastUpdatedAt: now,
          },
        });
      }),
  );
}

export const GET: RequestHandler = async ({ url }) => {
  const query = url.searchParams.get("q")?.trim() ?? "";
  const requestedLimit = Number(url.searchParams.get("limit") ?? 20);
  const limit = Math.max(1, Math.min(20, Number.isFinite(requestedLimit) ? requestedLimit : 20));

  if (!query) return json([]);

  let players = await findLocalPlayers(query, limit);
  if (!players.length) {
    try {
      const nativePlayers = await searchNativeCollector(query, limit);
      if (nativePlayers.length) {
        await cacheNativePlayers(nativePlayers);
        players = await findLocalPlayers(query, limit);
      }
    } catch (error) {
      console.warn("[player-search] native fallback failed", error);
    }
  }

  return json(players.map(mapPlayer));
};
