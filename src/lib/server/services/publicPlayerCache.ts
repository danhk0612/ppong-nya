import { db } from "$lib/server/db";
import { fetchExternalApi } from "$lib/server/services/externalApi";

const NATIVE_SOURCE = "majsoul-native";
const UPSTREAM_SOURCE = "amae-koromo";
const SUPPORTED_YONMA_MODE_IDS = [2, 3, 5, 6, 8, 9, 11, 12, 15, 16] as const;
const SUPPORTED_YONMA_MODE_SET = new Set<number>(SUPPORTED_YONMA_MODE_IDS);
const RECORDS_PER_FETCH = 100;
const STALE_THRESHOLD_HOURS = 24;
const FAILURE_COOLDOWN_MINUTES = 10;

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 15)}`;
}

export const PUBLIC_PLAYER_CACHE_DEFAULTS = {
  retentionDays: 90,
  maxRecordsPerPlayer: 2000,
  defaultRangeDays: 30,
} as const;

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
  upstreamMessage?: string;
};

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

export async function getCachedPlayer(playerId: string) {
  return db.cachedPlayer.findUnique({ where: { playerId } });
}

export async function getCachedPlayerRecords(input: {
  cachedPlayerId: string;
  periodStart: Date;
  periodEnd: Date;
  externalModeIds?: number[];
}) {
  const externalModeIds = normalizeModes(input.externalModeIds);
  return db.cachedPlayerGameRecord.findMany({
    where: {
      cachedPlayerId: input.cachedPlayerId,
      gameRecord: {
        source: { in: [NATIVE_SOURCE, UPSTREAM_SOURCE] },
        startedAt: { gte: input.periodStart, lte: input.periodEnd },
        externalModeId: { in: externalModeIds },
      },
    },
    orderBy: { gameRecord: { startedAt: "desc" } },
    include: {
      gameRecord: { include: { players: { orderBy: { seat: "asc" } } } },
    },
  });
}

type UpstreamGameRecord = {
  _id?: string;
  uuid?: string;
  modeId: number;
  startTime: number;
  endTime?: number;
  players: Array<{
    accountId: number;
    nickname: string;
    level?: { id?: number; score?: number };
    level3?: { id?: number; score?: number };
    score: number;
    gradingScore?: number;
  }>;
};

function isStale(lastUpdatedAt: Date | null, thresholdHours: number): boolean {
  if (!lastUpdatedAt) return true;
  const hoursSinceUpdate = (Date.now() - lastUpdatedAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceUpdate > thresholdHours;
}

async function fetchPlayerRecordsFromUpstream(
  playerId: string,
  periodEnd: Date,
  periodStart: Date,
  modeIds?: number[],
): Promise<UpstreamGameRecord[]> {
  const cursor = Math.floor(periodEnd.getTime());
  const start = Math.floor(periodStart.getTime());
  const modeParam = modeIds?.length ? modeIds.join(".") : "";
  
  const path = `player_records/${playerId}/${cursor}/${start}?limit=${RECORDS_PER_FETCH}&mode=${modeParam}&descending=true`;
  
  console.log(`[public-player-cache] fetching upstream records path=${path}`);
  
  const response = await fetchExternalApi({
    host: "",
    path,
    method: "GET",
  });
  
  if (!response.ok) {
    const status = response.status;
    console.warn(`[public-player-cache] upstream fetch failed status=${status} playerId=${playerId}`);
    throw new Error(`Upstream player_records failed: HTTP ${status}`);
  }
  
  const records = (await response.json()) as UpstreamGameRecord[];
  console.log(`[public-player-cache] fetched ${records.length} upstream records for playerId=${playerId}`);
  
  return records;
}

async function storeUpstreamRecords(
  cachedPlayerId: string,
  playerId: string,
  records: UpstreamGameRecord[],
): Promise<number> {
  let stored = 0;
  
  for (const record of records) {
    const uuid = record.uuid || record._id;
    if (!uuid) {
      console.warn("[public-player-cache] skipping record without uuid/id");
      continue;
    }
    
    const modeId = record.modeId;
    if (!SUPPORTED_YONMA_MODE_SET.has(modeId)) {
      continue;
    }
    
    try {
      const existing = await db.gameRecord.findFirst({
        where: {
          OR: [
            { source: UPSTREAM_SOURCE, sourceRecordId: uuid },
            { source: UPSTREAM_SOURCE, uuid },
          ],
        },
        select: { id: true },
      });
      
      let gameRecordId: string;
      
      if (existing) {
        gameRecordId = existing.id;
      } else {
        gameRecordId = generateId();
        const startedAt = new Date(record.startTime * 1000);
        const endedAt = record.endTime ? new Date(record.endTime * 1000) : startedAt;
        
        await db.gameRecord.create({
          data: {
            id: gameRecordId,
            source: UPSTREAM_SOURCE,
            sourceRecordId: uuid,
            uuid,
            mode: "YONMA",
            externalModeId: modeId,
            startedAt,
            endedAt,
            metadata: { source: "upstream-player-fetch" },
          },
        });
        
        for (let seat = 0; seat < record.players.length; seat++) {
          const player = record.players[seat];
          if (!player) continue;
          
          const placement = record.players
            .map((p, idx) => ({ score: p.score, idx }))
            .sort((a, b) => b.score - a.score)
            .findIndex((p) => p.idx === seat) + 1;
          
          await db.player.create({
            data: {
              id: generateId(),
              gameRecordId,
              seat,
              accountId: String(player.accountId),
              nickname: player.nickname,
              score: player.score,
              placement,
              ratingDelta: player.gradingScore != null ? player.gradingScore : null,
              metadata: {
                levelId: player.level?.id,
                levelScore: player.level?.score,
                level3Id: player.level3?.id,
                level3Score: player.level3?.score,
              },
            },
          });
        }
      }
      
      await db.cachedPlayerGameRecord.upsert({
        where: {
          cachedPlayerId_gameRecordId: {
            cachedPlayerId,
            gameRecordId,
          },
        },
        create: {
          cachedPlayerId,
          gameRecordId,
        },
        update: {},
      });
      
      stored++;
    } catch (error) {
      console.warn(`[public-player-cache] failed to store record uuid=${uuid}:`, error);
    }
  }
  
  return stored;
}

export async function getPublicPlayerState(input: {
  playerId: string;
  periodStart: Date;
  periodEnd: Date;
  externalModeIds?: number[];
  forceRefresh?: boolean;
}): Promise<PublicPlayerState | null> {
  const player = await getCachedPlayer(input.playerId);
  if (!player) return null;

  await db.cachedPlayer.update({
    where: { id: player.id },
    data: { lastAccessedAt: new Date() },
  });

  const externalModeIds = normalizeModes(input.externalModeIds);
  let records = await getCachedPlayerRecords({
    cachedPlayerId: player.id,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    externalModeIds,
  });

  const hasRecords = records.length > 0;
  const dataIsStale = isStale(player.lastUpdatedAt, STALE_THRESHOLD_HOURS);
  const inCooldown = !isStale(player.lastUpdatedAt, FAILURE_COOLDOWN_MINUTES / 60);
  
  const needsRefresh = 
    input.forceRefresh ||
    (hasRecords && dataIsStale) ||
    (!hasRecords && !inCooldown);

  let upstreamMessage: string | undefined;

  if (needsRefresh) {
    console.log(
      `[public-player-cache] refreshing data playerId=${input.playerId} forceRefresh=${input.forceRefresh} recordCount=${records.length} stale=${dataIsStale} inCooldown=${inCooldown}`,
    );
    
    try {
      const upstreamRecords = await fetchPlayerRecordsFromUpstream(
        input.playerId,
        input.periodEnd,
        input.periodStart,
        externalModeIds,
      );
      
      if (upstreamRecords.length > 0) {
        const stored = await storeUpstreamRecords(
          player.id,
          input.playerId,
          upstreamRecords,
        );
        
        console.log(`[public-player-cache] stored ${stored}/${upstreamRecords.length} records for playerId=${input.playerId}`);
        
        await db.cachedPlayer.update({
          where: { id: player.id },
          data: { lastUpdatedAt: new Date() },
        });
        
        records = await getCachedPlayerRecords({
          cachedPlayerId: player.id,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          externalModeIds,
        });
      } else {
        await db.cachedPlayer.update({
          where: { id: player.id },
          data: { lastUpdatedAt: new Date() },
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isRateLimited = errorMessage.includes("429");
      
      await db.cachedPlayer.update({
        where: { id: player.id },
        data: { lastUpdatedAt: new Date() },
      });
      
      if (isRateLimited) {
        console.warn(`[public-player-cache] rate limited (429) for playerId=${input.playerId}, cooldown active for ${FAILURE_COOLDOWN_MINUTES} minutes`);
        upstreamMessage = "rate_limited";
      } else {
        console.warn(`[public-player-cache] upstream fetch failed for playerId=${input.playerId}: ${errorMessage}`);
        upstreamMessage = "fetch_failed";
      }
    }
  } else if (!hasRecords && inCooldown) {
    console.log(
      `[public-player-cache] skipping refresh due to cooldown playerId=${input.playerId} lastUpdatedAt=${player.lastUpdatedAt?.toISOString()}`,
    );
    upstreamMessage = "in_cooldown";
  }

  const rangeCovered = records.length > 0;
  const stale = isStale(player.lastUpdatedAt, STALE_THRESHOLD_HOURS);

  return {
    player,
    records,
    modeKey: getPublicPlayerModeKey(externalModeIds),
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    rangeCovered,
    stale,
    upstreamMessage,
  };
}
