import type { Prisma } from "@prisma/client";
import { error, json } from "@sveltejs/kit";
import { requireApiSession } from "$lib/server/auth";
import { db } from "$lib/server/db";
import { getExternalApiCacheTtl } from "$lib/server/services/externalApi";
import type { RequestHandler } from "./$types";

const SOURCE = "amae-koromo";
const STATS_TTL_SECONDS =
  getExternalApiCacheTtl("player_stats/:playerId") ?? 60 * 60;
const RECORDS_TTL_SECONDS =
  getExternalApiCacheTtl("player_records/:playerId/:cursor/:start") ?? 10 * 60;
const YONMA_MODE_IDS = new Set([8, 9, 11, 12, 15, 16]);

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

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function expiresAt(seconds: number) {
  return new Date(Date.now() + seconds * 1000);
}

async function requireFavorite(userId: string, playerId: string) {
  const favorite = await db.favoritePlayer.findUnique({
    where: { userId_playerId: { userId, playerId } },
  });

  if (!favorite) {
    error(404, "즐겨찾기 플레이어를 찾을 수 없습니다.");
  }

  return favorite;
}

async function buildSyncState(
  userId: string,
  favorite: Awaited<ReturnType<typeof requireFavorite>>,
) {
  const [snapshots, links] = await Promise.all([
    db.playerSnapshot.findMany({
      where: {
        userId,
        playerId: favorite.playerId,
        scope: { in: ["stats", "extended_stats", "records"] },
      },
    }),
    db.favoriteGameRecord.findMany({
      where: { favoritePlayerId: favorite.id },
      orderBy: { gameRecord: { startedAt: "desc" } },
      take: 30,
      include: {
        gameRecord: {
          include: { players: { orderBy: { seat: "asc" } } },
        },
      },
    }),
  ]);

  const byScope = new Map(
    snapshots.map((snapshot) => [snapshot.scope, snapshot]),
  );
  const stats = byScope.get("stats");
  const extendedStats = byScope.get("extended_stats");
  const recordsState = byScope.get("records");
  const recordsStatePayload = objectValue(recordsState?.payload);
  const expectedRecordCount =
    typeof recordsStatePayload?.count === "number"
      ? recordsStatePayload.count
      : 0;
  const now = new Date();
  const lastRefreshedAt = [stats, extendedStats, recordsState]
    .filter((snapshot) => snapshot)
    .map((snapshot) => snapshot!.computedAt)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const records = links.map(({ gameRecord }) => {
    const rawPayload = objectValue(gameRecord.rawPayload);
    if (rawPayload) return rawPayload;

    return {
      modeId: gameRecord.externalModeId,
      uuid: gameRecord.uuid,
      startTime: Math.floor(gameRecord.startedAt.getTime() / 1000),
      endTime: gameRecord.endedAt
        ? Math.floor(gameRecord.endedAt.getTime() / 1000)
        : Math.floor(gameRecord.startedAt.getTime() / 1000),
      players: gameRecord.players.map((player) => ({
        accountId: Number(player.accountId),
        nickname: player.nickname,
        level: objectValue(player.metadata)?.level ?? 0,
        score: player.score,
      })),
    };
  });

  return {
    playerId: favorite.playerId,
    metadata: stats?.payload ?? null,
    extendedStats: extendedStats?.payload ?? null,
    records,
    lastRefreshedAt: lastRefreshedAt?.toISOString() ?? null,
    needsStatsRefresh:
      !stats ||
      !extendedStats ||
      !stats.expiresAt ||
      !extendedStats.expiresAt ||
      stats.expiresAt <= now ||
      extendedStats.expiresAt <= now,
    needsRecordsRefresh:
      !recordsState ||
      !recordsState.expiresAt ||
      recordsState.expiresAt <= now ||
      (expectedRecordCount > 0 && links.length === 0),
  };
}

export const GET: RequestHandler = async (event) => {
  const session = await requireApiSession(event);
  const playerId = event.url.searchParams.get("playerId")?.trim();

  if (!playerId) {
    error(400, "플레이어 ID가 필요합니다.");
  }

  const favorite = await requireFavorite(session.user.id, playerId);
  return json(await buildSyncState(session.user.id, favorite));
};

export const POST: RequestHandler = async (event) => {
  const session = await requireApiSession(event);
  const playerId = event.url.searchParams.get("playerId")?.trim();

  if (!playerId) {
    error(400, "플레이어 ID가 필요합니다.");
  }

  const favorite = await requireFavorite(session.user.id, playerId);
  const body = objectValue(await event.request.json().catch(() => null));

  if (!body) {
    error(400, "저장할 전적 데이터가 없습니다.");
  }

  const metadata = objectValue(body.metadata);
  const extendedStats = objectValue(body.extendedStats);
  const records = Array.isArray(body.records)
    ? body.records
        .filter((record): record is ExternalRecord =>
          Boolean(
            objectValue(record) &&
            typeof record.uuid === "string" &&
            typeof record.modeId === "number" &&
            YONMA_MODE_IDS.has(record.modeId) &&
            typeof record.startTime === "number" &&
            Array.isArray(record.players) &&
            record.players.length === 4 &&
            record.players.some((player: unknown) => {
              const playerObject = objectValue(player);
              return (
                playerObject && String(playerObject.accountId) === playerId
              );
            }),
          ),
        )
        .slice(0, 30)
    : undefined;

  if (Boolean(metadata) !== Boolean(extendedStats)) {
    error(400, "기본 통계와 상세 통계를 함께 저장해야 합니다.");
  }

  if (!metadata && !records) {
    error(400, "저장할 통계 또는 최근 전적이 없습니다.");
  }

  await db.$transaction(async (transaction) => {
    if (metadata && extendedStats) {
      const snapshotExpiry = expiresAt(STATS_TTL_SECONDS);
      const nickname =
        typeof metadata.nickname === "string"
          ? metadata.nickname.trim() || favorite.nickname
          : favorite.nickname;

      await Promise.all([
        transaction.playerSnapshot.upsert({
          where: {
            userId_playerId_scope: {
              userId: session.user.id,
              playerId,
              scope: "stats",
            },
          },
          create: {
            userId: session.user.id,
            playerId,
            nickname,
            scope: "stats",
            modes: metadata.played_modes as Prisma.InputJsonValue | undefined,
            payload: metadata as Prisma.InputJsonValue,
            expiresAt: snapshotExpiry,
          },
          update: {
            nickname,
            modes: metadata.played_modes as Prisma.InputJsonValue | undefined,
            payload: metadata as Prisma.InputJsonValue,
            computedAt: new Date(),
            expiresAt: snapshotExpiry,
          },
        }),
        transaction.playerSnapshot.upsert({
          where: {
            userId_playerId_scope: {
              userId: session.user.id,
              playerId,
              scope: "extended_stats",
            },
          },
          create: {
            userId: session.user.id,
            playerId,
            nickname,
            scope: "extended_stats",
            payload: extendedStats as Prisma.InputJsonValue,
            expiresAt: snapshotExpiry,
          },
          update: {
            nickname,
            payload: extendedStats as Prisma.InputJsonValue,
            computedAt: new Date(),
            expiresAt: snapshotExpiry,
          },
        }),
        transaction.favoritePlayer.update({
          where: { id: favorite.id },
          data: {
            nickname,
            metadata: {
              level: metadata.level,
              maxLevel: metadata.max_level,
              lastRefreshedAt: new Date().toISOString(),
            } as Prisma.InputJsonValue,
          },
        }),
      ]);
    }

    if (records) {
      for (const record of records) {
        const players = record.players.filter(
          (player) =>
            player &&
            typeof player.accountId === "number" &&
            typeof player.nickname === "string" &&
            typeof player.score === "number",
        );
        const rankedSeats = players
          .map((player, seat) => ({
            seat,
            value: player.score + 5 - seat,
          }))
          .sort((a, b) => b.value - a.value);
        const placementBySeat = new Map(
          rankedSeats.map((entry, index) => [entry.seat, index + 1]),
        );

        const gameRecord = await transaction.gameRecord.upsert({
          where: {
            source_uuid: { source: SOURCE, uuid: record.uuid },
          },
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

        for (const [seat, player] of players.entries()) {
          await transaction.player.upsert({
            where: {
              gameRecordId_seat: { gameRecordId: gameRecord.id, seat },
            },
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

        await transaction.favoriteGameRecord.upsert({
          where: {
            favoritePlayerId_gameRecordId: {
              favoritePlayerId: favorite.id,
              gameRecordId: gameRecord.id,
            },
          },
          create: {
            favoritePlayerId: favorite.id,
            gameRecordId: gameRecord.id,
          },
          update: {},
        });
      }

      await transaction.playerSnapshot.upsert({
        where: {
          userId_playerId_scope: {
            userId: session.user.id,
            playerId,
            scope: "records",
          },
        },
        create: {
          userId: session.user.id,
          playerId,
          nickname: favorite.nickname,
          scope: "records",
          payload: { count: records.length },
          expiresAt: expiresAt(RECORDS_TTL_SECONDS),
        },
        update: {
          payload: { count: records.length },
          computedAt: new Date(),
          expiresAt: expiresAt(RECORDS_TTL_SECONDS),
        },
      });
    }
  });

  const updatedFavorite = await requireFavorite(session.user.id, playerId);
  return json(await buildSyncState(session.user.id, updatedFavorite));
};
