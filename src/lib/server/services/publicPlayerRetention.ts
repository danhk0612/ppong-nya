import { env } from "$env/dynamic/private";
import { db } from "$lib/server/db";

const SOURCE = "amae-koromo";
const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_MAX_RECORDS_PER_PLAYER = 2000;
const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000;

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const PUBLIC_PLAYER_RETENTION = {
  retentionDays: positiveInteger(
    env.PLAYER_CACHE_RETENTION_DAYS,
    DEFAULT_RETENTION_DAYS,
  ),
  maxRecordsPerPlayer: positiveInteger(
    env.PLAYER_CACHE_MAX_RECORDS,
    DEFAULT_MAX_RECORDS_PER_PLAYER,
  ),
} as const;

let lastMaintenanceAt = 0;
let maintenancePromise: Promise<void> | null = null;

async function trimPlayerRecords(cachedPlayerId: string) {
  const overflow = await db.cachedPlayerGameRecord.findMany({
    where: { cachedPlayerId },
    orderBy: { gameRecord: { startedAt: "desc" } },
    skip: PUBLIC_PLAYER_RETENTION.maxRecordsPerPlayer,
    select: { gameRecordId: true },
  });

  if (!overflow.length) return;

  await db.cachedPlayerGameRecord.deleteMany({
    where: {
      cachedPlayerId,
      gameRecordId: { in: overflow.map((entry) => entry.gameRecordId) },
    },
  });
}

async function cleanupPublicPlayerCache() {
  const now = new Date();
  const retentionCutoff = new Date(
    now.getTime() - PUBLIC_PLAYER_RETENTION.retentionDays * 24 * 60 * 60 * 1000,
  );

  await db.playerStatisticsCache.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  await db.externalApiCache.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  await db.playerQueryCoverage.deleteMany({
    where: { fetchedAt: { lt: retentionCutoff } },
  });

  await db.cachedPlayer.deleteMany({
    where: { lastAccessedAt: { lt: retentionCutoff } },
  });

  const activePlayers = await db.cachedPlayer.findMany({ select: { id: true } });
  for (const player of activePlayers) {
    await trimPlayerRecords(player.id);
  }

  await db.gameRecord.deleteMany({
    where: {
      source: SOURCE,
      userId: null,
      cachedPlayerLinks: { none: {} },
      favoriteLinks: { none: {} },
    },
  });
}

export async function runPublicPlayerCacheMaintenance() {
  const now = Date.now();
  if (now - lastMaintenanceAt < MAINTENANCE_INTERVAL_MS) return;

  maintenancePromise ??= cleanupPublicPlayerCache()
    .then(() => {
      lastMaintenanceAt = Date.now();
    })
    .finally(() => {
      maintenancePromise = null;
    });

  await maintenancePromise;
}
