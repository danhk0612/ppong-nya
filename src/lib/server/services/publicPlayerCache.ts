import { db } from "$lib/server/db";

const NATIVE_SOURCE = "majsoul-native";
const SUPPORTED_YONMA_MODE_IDS = [2, 3, 5, 6, 8, 9, 11, 12, 15, 16] as const;
const SUPPORTED_YONMA_MODE_SET = new Set<number>(SUPPORTED_YONMA_MODE_IDS);

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
        source: NATIVE_SOURCE,
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
  const records = await getCachedPlayerRecords({
    cachedPlayerId: player.id,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    externalModeIds,
  });

  return {
    player,
    records,
    modeKey: getPublicPlayerModeKey(externalModeIds),
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    rangeCovered: true,
    stale: false,
  };
}
