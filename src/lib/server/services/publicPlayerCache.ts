import type { Prisma } from "@prisma/client";
import { db } from "$lib/server/db";

export const PUBLIC_PLAYER_CACHE_DEFAULTS = {
  retentionDays: 90,
  maxRecordsPerPlayer: 2000,
} as const;

export type CachedPlayerIdentity = {
  playerId: string;
  nickname: string;
  level?: number | null;
  maxLevel?: number | null;
  latestTimestamp?: number | null;
};

export async function touchCachedPlayer(identity: CachedPlayerIdentity) {
  const now = new Date();

  return db.cachedPlayer.upsert({
    where: { playerId: identity.playerId },
    create: {
      playerId: identity.playerId,
      nickname: identity.nickname,
      level: identity.level ?? null,
      maxLevel: identity.maxLevel ?? null,
      latestTimestamp:
        identity.latestTimestamp == null ? null : BigInt(identity.latestTimestamp),
      lastAccessedAt: now,
    },
    update: {
      nickname: identity.nickname,
      level: identity.level ?? undefined,
      maxLevel: identity.maxLevel ?? undefined,
      latestTimestamp:
        identity.latestTimestamp == null ? undefined : BigInt(identity.latestTimestamp),
      lastAccessedAt: now,
    },
  });
}

export async function markCachedPlayerUpdated(playerId: string) {
  return db.cachedPlayer.update({
    where: { playerId },
    data: { lastAccessedAt: new Date(), lastUpdatedAt: new Date() },
  });
}

export async function findCachedPlayersByNickname(nickname: string) {
  return db.cachedPlayer.findMany({
    where: { nickname },
    orderBy: [{ lastUpdatedAt: "desc" }, { latestTimestamp: "desc" }],
  });
}

export async function linkCachedPlayerGame(
  cachedPlayerId: string,
  gameRecordId: string,
) {
  return db.cachedPlayerGameRecord.upsert({
    where: {
      cachedPlayerId_gameRecordId: { cachedPlayerId, gameRecordId },
    },
    create: { cachedPlayerId, gameRecordId },
    update: {},
  });
}

export async function upsertPlayerQueryCoverage(input: {
  cachedPlayerId: string;
  modeKey: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  return db.playerQueryCoverage.upsert({
    where: {
      cachedPlayerId_modeKey_periodStart_periodEnd: {
        cachedPlayerId: input.cachedPlayerId,
        modeKey: input.modeKey,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      },
    },
    create: input,
    update: { fetchedAt: new Date() },
  });
}

export async function getCachedPlayerRecords(input: {
  cachedPlayerId: string;
  periodStart: Date;
  periodEnd: Date;
  externalModeIds?: number[];
}) {
  return db.cachedPlayerGameRecord.findMany({
    where: {
      cachedPlayerId: input.cachedPlayerId,
      gameRecord: {
        startedAt: { gte: input.periodStart, lte: input.periodEnd },
        ...(input.externalModeIds?.length
          ? { externalModeId: { in: input.externalModeIds } }
          : {}),
      },
    },
    orderBy: { gameRecord: { startedAt: "desc" } },
    include: {
      gameRecord: { include: { players: { orderBy: { seat: "asc" } } } },
    },
  });
}

export async function upsertPlayerStatisticsCache(input: {
  cachedPlayerId: string;
  cacheKey: string;
  modeKey: string;
  periodStart: Date;
  periodEnd: Date;
  payload: Prisma.InputJsonValue;
  expiresAt?: Date | null;
}) {
  return db.playerStatisticsCache.upsert({
    where: { cacheKey: input.cacheKey },
    create: input,
    update: {
      modeKey: input.modeKey,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      payload: input.payload,
      computedAt: new Date(),
      expiresAt: input.expiresAt ?? null,
    },
  });
}
