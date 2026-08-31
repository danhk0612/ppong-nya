import type { Prisma } from "@prisma/client";
import { db } from "$lib/server/db";
import {
  fetchExternalApi,
  getExternalApiCacheTtl,
} from "$lib/server/services/externalApi";
import type { PublicPlayerState } from "$lib/server/services/publicPlayerCache";
import { upsertPlayerStatisticsCache } from "$lib/server/services/publicPlayerCache";

const STATS_TTL_SECONDS =
  getExternalApiCacheTtl("player_stats/:playerId") ?? 60 * 60;

type PublicPlayerStatisticsPayload = {
  metadata: Prisma.JsonValue;
  extendedStats: Prisma.JsonValue;
};

function cacheKey(state: PublicPlayerState) {
  return [
    "player",
    state.player.playerId,
    state.periodStart.getTime(),
    state.periodEnd.getTime(),
    state.modeKey,
  ].join(":");
}

async function readExternalJson<T>(input: {
  host: string;
  path: string;
  method: "POST";
  body: string;
}) {
  const response = await fetchExternalApi({
    host: input.host,
    path: input.path,
    method: input.method,
    body: input.body,
    headers: { "content-type": "application/json" },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String(payload.message)
        : `External API request failed with status ${response.status}.`;
    throw Object.assign(new Error(message), { status: response.status });
  }

  return payload as T;
}

export async function getCachedPublicPlayerStatistics(state: PublicPlayerState) {
  const cached = await db.playerStatisticsCache.findUnique({
    where: { cacheKey: cacheKey(state) },
  });

  if (!cached || (cached.expiresAt && cached.expiresAt <= new Date())) {
    return null;
  }

  return cached.payload as PublicPlayerStatisticsPayload;
}

export async function getPublicPlayerStatistics(input: {
  host: string;
  state: PublicPlayerState;
  force?: boolean;
}) {
  if (!input.force) {
    const cached = await getCachedPublicPlayerStatistics(input.state);
    if (cached) return cached;
  }

  const keys = input.state.records.map(({ gameRecord }) =>
    Math.floor(gameRecord.startedAt.getTime() / 1000),
  );
  if (!keys.length) {
    return { metadata: null, extendedStats: null };
  }

  const modes = input.state.modeKey
    .split(".")
    .map((mode) => Number(mode))
    .filter((mode) => Number.isInteger(mode));
  const body = JSON.stringify({ keys, modes });
  const playerId = input.state.player.playerId;
  const [metadata, extendedStats] = await Promise.all([
    readExternalJson<Prisma.JsonValue>({
      host: input.host,
      path: `player_stats/${playerId}`,
      method: "POST",
      body,
    }),
    readExternalJson<Prisma.JsonValue>({
      host: input.host,
      path: `player_extended_stats/${playerId}`,
      method: "POST",
      body,
    }),
  ]);

  const payload: PublicPlayerStatisticsPayload = { metadata, extendedStats };
  await upsertPlayerStatisticsCache({
    cachedPlayerId: input.state.player.id,
    cacheKey: cacheKey(input.state),
    modeKey: input.state.modeKey,
    periodStart: input.state.periodStart,
    periodEnd: input.state.periodEnd,
    payload: payload as Prisma.InputJsonValue,
    expiresAt: new Date(Date.now() + STATS_TTL_SECONDS * 1000),
  });

  return payload;
}
