import type { Prisma } from "@prisma/client";
import { db } from "$lib/server/db";
import {
  fetchExternalApi,
  getExternalApiCacheTtl,
} from "$lib/server/services/externalApi";

const SOURCE = "amae-koromo";
const SUPPORTED_YONMA_MODE_IDS = [2, 3, 5, 6, 8, 9, 11, 12, 15, 16] as const;
const SUPPORTED_YONMA_MODE_SET = new Set<number>(SUPPORTED_YONMA_MODE_IDS);
const RECORD_PAGE_SIZE = 100;
const RECORD_REFRESH_TTL_SECONDS =
  getExternalApiCacheTtl("player_records/:playerId/:cursor/:start") ?? 10 * 60;

export const PUBLIC_PLAYER_CACHE_DEFAULTS = {
  retentionDays: 90,
  maxRecordsPerPlayer: 2000,
  defaultRangeDays: 30,
} as const;

export type CachedPlayerIdentity = {
  playerId: string;
  nickname: string;
  level?: number | null;
  maxLevel?: number | null;
  latestTimestamp?: number | null;
};

type ExternalLevel = {
  id?: number;
};

type ExternalPlayerMetadata = {
  id?: number;
  nickname?: string;
  level?: ExternalLevel | number;
  max_level?: ExternalLevel | number;
  count?: number;
};

type ExternalPlayer = {
  accountId: number;
  nickname: string;
  level: number;
  score: number;
  gradingScore?: number;
};

type ExternalRecord = {
  modeId: number;
  uuid: string;
  startTime: number;
  endTime: number;
  players: ExternalPlayer[];
};

export type PublicPlayerRange = {
  periodStart: Date;
  periodEnd: Date;
  externalModeIds: number[];
};

export type PublicPlayerState = {
  player: NonNullable<Awaited<ReturnType<typeof getCachedPlayer>>>;
  records: Awaited<ReturnType<typeof getCachedPlayerRecords>>;
  modeKey: string;
  periodStart: Date;
  periodEnd: Date;
  rangeCovered: boolean;
  stale: boolean;
};

function levelId(value: ExternalLevel | number | undefined) {
  if (typeof value === "number") return value;
  return typeof value?.id === "number" ? value.id : null;
}

function normalizeModes(modes?: number[]) {
  if (!modes?.length) return [...SUPPORTED_YONMA_MODE_IDS];
  return [...new Set(modes.filter((mode) => SUPPORTED_YONMA_MODE_SET.has(mode)))].sort(
    (a, b) => a - b,
  );
}

export function getPublicPlayerModeKey(modes?: number[]) {
  return normalizeModes(modes).join(".");
}

export function getDefaultPublicPlayerRange(now = new Date()): PublicPlayerRange {
  const periodEnd = new Date(now);
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - PUBLIC_PLAYER_CACHE_DEFAULTS.defaultRangeDays);

  return {
    periodStart,
    periodEnd,
    externalModeIds: [...SUPPORTED_YONMA_MODE_IDS],
  };
}

async function readExternalJson<T>(host: string, path: string) {
  const response = await fetchExternalApi({ host, path });
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

export async function getCachedPlayer(playerId: string) {
  return db.cachedPlayer.findUnique({ where: { playerId } });
}

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
  const now = new Date();
  return db.cachedPlayer.update({
    where: { playerId },
    data: { lastAccessedAt: now, lastUpdatedAt: now },
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

export async function isPlayerRangeCovered(input: {
  cachedPlayerId: string;
  modeKey: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  const coverage = await db.playerQueryCoverage.findFirst({
    where: {
      cachedPlayerId: input.cachedPlayerId,
      modeKey: input.modeKey,
      periodStart: { lte: input.periodStart },
      periodEnd: { gte: input.periodEnd },
    },
    orderBy: { fetchedAt: "desc" },
  });
  return Boolean(coverage);
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

async function getLatestCachedRecordStart(input: {
  cachedPlayerId: string;
  externalModeIds: number[];
}) {
  const latest = await db.cachedPlayerGameRecord.findFirst({
    where: {
      cachedPlayerId: input.cachedPlayerId,
      gameRecord: { externalModeId: { in: input.externalModeIds } },
    },
    orderBy: { gameRecord: { startedAt: "desc" } },
    select: { gameRecord: { select: { startedAt: true } } },
  });
  return latest?.gameRecord.startedAt ?? null;
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

async function fetchPlayerMetadata(input: {
  host: string;
  playerId: string;
  force?: boolean;
}) {
  const start = new Date("2010-01-01T00:00:00.000Z").getTime();
  const end = Date.now();
  const modeKey = getPublicPlayerModeKey();
  const tag = input.force ? Date.now() : Math.floor(Date.now() / 3_600_000);

  return readExternalJson<ExternalPlayerMetadata>(
    input.host,
    `player_stats/${input.playerId}/${start}/${end}?mode=${modeKey}&tag=${tag}`,
  );
}

async function ensureCachedPlayer(input: {
  host: string;
  playerId: string;
  refreshIdentity?: boolean;
  force?: boolean;
}) {
  const existing = await getCachedPlayer(input.playerId);
  if (existing && !input.refreshIdentity) {
    await db.cachedPlayer.update({
      where: { id: existing.id },
      data: { lastAccessedAt: new Date() },
    });
    return existing;
  }

  const metadata = await fetchPlayerMetadata({
    host: input.host,
    playerId: input.playerId,
    force: input.force,
  });
  const nickname = metadata.nickname?.trim();
  if (!nickname) {
    throw Object.assign(new Error("플레이어 정보를 찾지 못했습니다."), { status: 404 });
  }

  return touchCachedPlayer({
    playerId: input.playerId,
    nickname,
    level: levelId(metadata.level),
    maxLevel: levelId(metadata.max_level),
  });
}

function isExternalRecord(value: unknown, playerId: string): value is ExternalRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<ExternalRecord>;
  return Boolean(
    typeof record.uuid === "string" &&
      typeof record.modeId === "number" &&
      SUPPORTED_YONMA_MODE_SET.has(record.modeId) &&
      typeof record.startTime === "number" &&
      Array.isArray(record.players) &&
      record.players.length === 4 &&
      record.players.some((player) => String(player?.accountId) === playerId),
  );
}

async function ingestExternalRecords(
  cachedPlayerId: string,
  records: ExternalRecord[],
) {
  if (!records.length) return;

  await db.$transaction(async (transaction) => {
    for (const record of records) {
      const rankedSeats = record.players
        .map((player, seat) => ({ seat, value: player.score + 5 - seat }))
        .sort((a, b) => b.value - a.value);
      const placementBySeat = new Map(
        rankedSeats.map((entry, index) => [entry.seat, index + 1]),
      );

      const gameRecord = await transaction.gameRecord.upsert({
        where: { source_uuid: { source: SOURCE, uuid: record.uuid } },
        create: {
          source: SOURCE,
          sourceRecordId: record.uuid,
          externalId: record.uuid,
          uuid: record.uuid,
          mode: "YONMA",
          externalModeId: record.modeId,
          startedAt: new Date(record.startTime * 1000),
          endedAt: new Date((record.endTime || record.startTime) * 1000),
          rawPayload: record as unknown as Prisma.InputJsonValue,
        },
        update: {
          externalModeId: record.modeId,
          startedAt: new Date(record.startTime * 1000),
          endedAt: new Date((record.endTime || record.startTime) * 1000),
          rawPayload: record as unknown as Prisma.InputJsonValue,
        },
      });

      for (const [seat, player] of record.players.entries()) {
        await transaction.player.upsert({
          where: { gameRecordId_seat: { gameRecordId: gameRecord.id, seat } },
          create: {
            gameRecordId: gameRecord.id,
            seat,
            accountId: String(player.accountId),
            nickname: player.nickname.trim() || player.nickname,
            score: player.score,
            placement: placementBySeat.get(seat) ?? seat + 1,
            metadata: { level: player.level },
          },
          update: {
            accountId: String(player.accountId),
            nickname: player.nickname.trim() || player.nickname,
            score: player.score,
            placement: placementBySeat.get(seat) ?? seat + 1,
            metadata: { level: player.level },
          },
        });
      }

      await transaction.cachedPlayerGameRecord.upsert({
        where: {
          cachedPlayerId_gameRecordId: {
            cachedPlayerId,
            gameRecordId: gameRecord.id,
          },
        },
        create: { cachedPlayerId, gameRecordId: gameRecord.id },
        update: {},
      });
    }
  });
}

async function fetchRecordRange(input: {
  host: string;
  playerId: string;
  periodStart: Date;
  periodEnd: Date;
  externalModeIds: number[];
  force?: boolean;
}) {
  const result: ExternalRecord[] = [];
  const modeKey = getPublicPlayerModeKey(input.externalModeIds);
  const startMillis = input.periodStart.getTime();
  let cursorMillis = input.periodEnd.getTime();
  const forceTag = input.force ? `&tag=${Date.now()}` : "";

  while (
    cursorMillis > startMillis &&
    result.length < PUBLIC_PLAYER_CACHE_DEFAULTS.maxRecordsPerPlayer
  ) {
    const path = `player_records/${input.playerId}/${cursorMillis}/${startMillis}?limit=${RECORD_PAGE_SIZE}&mode=${modeKey}&descending=true${forceTag}`;
    const chunk = (await readExternalJson<unknown[]>(input.host, path)).filter(
      (record) => isExternalRecord(record, input.playerId),
    );

    if (!chunk.length) break;
    result.push(...chunk);

    const oldest = chunk[chunk.length - 1];
    const nextCursor = oldest.startTime * 1000 - 1;
    if (nextCursor >= cursorMillis) break;
    cursorMillis = nextCursor;

    if (chunk.length < RECORD_PAGE_SIZE) break;
  }

  return result.slice(0, PUBLIC_PLAYER_CACHE_DEFAULTS.maxRecordsPerPlayer);
}

export function isPublicPlayerStale(lastUpdatedAt: Date | null) {
  if (!lastUpdatedAt) return true;
  return Date.now() - lastUpdatedAt.getTime() >= RECORD_REFRESH_TTL_SECONDS * 1000;
}

export async function getPublicPlayerState(input: {
  playerId: string;
  periodStart: Date;
  periodEnd: Date;
  externalModeIds?: number[];
}): Promise<PublicPlayerState | null> {
  const player = await getCachedPlayer(input.playerId);
  if (!player) return null;

  await db.cachedPlayer.update({
    where: { id: player.id },
    data: { lastAccessedAt: new Date() },
  });

  const externalModeIds = normalizeModes(input.externalModeIds);
  const modeKey = getPublicPlayerModeKey(externalModeIds);
  const [records, rangeCovered] = await Promise.all([
    getCachedPlayerRecords({
      cachedPlayerId: player.id,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      externalModeIds,
    }),
    isPlayerRangeCovered({
      cachedPlayerId: player.id,
      modeKey,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    }),
  ]);

  return {
    player,
    records,
    modeKey,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    rangeCovered,
    stale: isPublicPlayerStale(player.lastUpdatedAt),
  };
}

export async function refreshPublicPlayer(input: {
  host: string;
  playerId: string;
  periodStart: Date;
  periodEnd: Date;
  externalModeIds?: number[];
  force?: boolean;
}) {
  if (input.periodEnd <= input.periodStart) {
    throw Object.assign(new Error("조회 종료일은 시작일보다 이후여야 합니다."), {
      status: 400,
    });
  }

  const externalModeIds = normalizeModes(input.externalModeIds);
  if (!externalModeIds.length) {
    throw Object.assign(new Error("지원되는 4인전 탁 종류가 필요합니다."), {
      status: 400,
    });
  }

  const existing = await getCachedPlayer(input.playerId);
  const identityStale = !existing || isPublicPlayerStale(existing.lastUpdatedAt);
  let player = await ensureCachedPlayer({
    host: input.host,
    playerId: input.playerId,
    refreshIdentity: Boolean(input.force || identityStale),
    force: input.force,
  });
  const modeKey = getPublicPlayerModeKey(externalModeIds);
  const rangeCovered = await isPlayerRangeCovered({
    cachedPlayerId: player.id,
    modeKey,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });
  const stale = isPublicPlayerStale(player.lastUpdatedAt);

  if (input.force || !rangeCovered || stale) {
    let fetchStart = input.periodStart;
    if (rangeCovered && stale && !input.force) {
      const latestRecordStart = await getLatestCachedRecordStart({
        cachedPlayerId: player.id,
        externalModeIds,
      });
      if (latestRecordStart && latestRecordStart > fetchStart) {
        fetchStart = new Date(latestRecordStart.getTime() + 1);
      }
    }

    const records =
      fetchStart < input.periodEnd
        ? await fetchRecordRange({
            host: input.host,
            playerId: input.playerId,
            periodStart: fetchStart,
            periodEnd: input.periodEnd,
            externalModeIds,
            force: input.force,
          })
        : [];

    await ingestExternalRecords(player.id, records);
    await upsertPlayerQueryCoverage({
      cachedPlayerId: player.id,
      modeKey,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    });

    const latestTimestamp = records.length
      ? Math.max(...records.map((record) => record.startTime))
      : undefined;
    player = await db.cachedPlayer.update({
      where: { id: player.id },
      data: {
        lastAccessedAt: new Date(),
        lastUpdatedAt: new Date(),
        ...(latestTimestamp
          ? { latestTimestamp: BigInt(latestTimestamp) }
          : {}),
      },
    });
  }

  return getPublicPlayerState({
    playerId: player.playerId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    externalModeIds,
  });
}
