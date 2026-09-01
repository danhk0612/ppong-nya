import { json } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import {
  getDefaultPublicPlayerRange,
  getPublicPlayerState,
  refreshPublicPlayer,
} from "$lib/server/services/publicPlayerCache";
import { runPublicPlayerCacheMaintenance } from "$lib/server/services/publicPlayerRetention";
import {
  getCachedPublicPlayerStatistics,
  getPublicPlayerStatistics,
} from "$lib/server/services/publicPlayerStatistics";
import type { RequestHandler } from "./$types";

const NATIVE_SOURCE = "majsoul-native";

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const numeric = Number(value);
  const date = new Date(Number.isFinite(numeric) ? numeric : value);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error("올바르지 않은 조회 기간입니다."), { status: 400 });
  }
  return date;
}

function parseModes(value: string | null) {
  if (!value || value === "all") return undefined;
  const modes = value
    .split(/[.,]/)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item));
  return modes.length ? modes : undefined;
}

function parseRange(url: URL) {
  const defaults = getDefaultPublicPlayerRange();
  return {
    periodStart: parseDate(url.searchParams.get("from"), defaults.periodStart),
    periodEnd: parseDate(url.searchParams.get("to"), defaults.periodEnd),
    externalModeIds: parseModes(url.searchParams.get("mode")),
  };
}

function readNumericMetadata(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  if (!(key in metadata)) return null;
  const value = Number((metadata as Record<string, unknown>)[key]);
  return Number.isFinite(value) ? value : null;
}

function readPlayerLevel(metadata: unknown) {
  return readNumericMetadata(metadata, "level") ?? readNumericMetadata(metadata, "levelId") ?? 0;
}

function serializeRecord(link: NonNullable<Awaited<ReturnType<typeof getPublicPlayerState>>>["records"][number]) {
  const { gameRecord } = link;
  if (gameRecord.source !== NATIVE_SOURCE && gameRecord.rawPayload) {
    return gameRecord.rawPayload;
  }

  return {
    modeId: gameRecord.externalModeId,
    uuid: gameRecord.uuid,
    startTime: Math.floor(gameRecord.startedAt.getTime() / 1000),
    endTime: Math.floor((gameRecord.endedAt ?? gameRecord.startedAt).getTime() / 1000),
    players: gameRecord.players.map((player) => ({
      accountId: Number(player.accountId),
      nickname: player.nickname,
      level: readPlayerLevel(player.metadata),
      score: player.score,
      gradingScore:
        player.ratingDelta == null ? undefined : Number(player.ratingDelta),
    })),
  };
}

type StatisticsPayload = Awaited<ReturnType<typeof getPublicPlayerStatistics>> | {
  metadata: unknown;
  extendedStats: unknown;
};

function getNativeStatistics(
  state: NonNullable<Awaited<ReturnType<typeof getPublicPlayerState>>>,
) {
  const playerId = state.player.playerId;
  const entries = state.records
    .map(({ gameRecord }) => {
      const player = gameRecord.players.find((item) => item.accountId === playerId);
      return player ? { gameRecord, player } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (!entries.length) {
    return { metadata: null, extendedStats: null };
  }

  const rankCounts = [0, 0, 0, 0];
  const rankScoreSums = [0, 0, 0, 0];
  for (const { player } of entries) {
    const index = Math.max(0, Math.min(3, player.placement - 1));
    rankCounts[index] += 1;
    rankScoreSums[index] += player.score;
  }

  const count = entries.length;
  const latest = entries[0].player;
  const latestLevelId = readNumericMetadata(latest.metadata, "levelId") ?? state.player.level ?? 10101;
  const latestLevelScore = readNumericMetadata(latest.metadata, "levelScore") ?? 0;
  const latestDelta = latest.ratingDelta == null ? 0 : Number(latest.ratingDelta);
  const maxLevelId = state.player.maxLevel ?? latestLevelId;

  return {
    metadata: {
      id: Number(playerId),
      nickname: state.player.nickname,
      count,
      level: { id: latestLevelId, score: latestLevelScore, delta: latestDelta },
      max_level: {
        id: maxLevelId,
        score: maxLevelId === latestLevelId ? latestLevelScore : 0,
        delta: maxLevelId === latestLevelId ? latestDelta : 0,
      },
      rank_rates: rankCounts.map((value) => value / count),
      avg_rank:
        rankCounts.reduce((sum, value, index) => sum + value * (index + 1), 0) / count,
      rank_avg_score: rankCounts.map((value, index) =>
        value ? rankScoreSums[index] / value : 0,
      ),
      negative_rate:
        entries.filter(({ player }) => player.score < 25000).length / count,
      played_modes: [...new Set(entries.map(({ gameRecord }) => gameRecord.externalModeId).filter(Boolean))],
    },
    extendedStats: null,
  };
}

function serializeState(
  state: NonNullable<Awaited<ReturnType<typeof getPublicPlayerState>>>,
  statistics: StatisticsPayload,
) {
  return {
    player: {
      ...state.player,
      latestTimestamp:
        state.player.latestTimestamp == null
          ? null
          : Number(state.player.latestTimestamp),
    },
    records: state.records.map(serializeRecord),
    modeKey: state.modeKey,
    periodStart: state.periodStart,
    periodEnd: state.periodEnd,
    rangeCovered: state.rangeCovered,
    stale: state.stale,
    statistics,
  };
}

function errorResponse(reason: unknown) {
  const status =
    reason && typeof reason === "object" && "status" in reason
      ? Number((reason as { status: unknown }).status) || 500
      : 500;
  const message =
    reason instanceof Error ? reason.message : "플레이어 데이터를 처리하지 못했습니다.";
  return json({ message }, { status });
}

async function hasNativePlayerRecords(cachedPlayerId: string) {
  return (
    (await db.cachedPlayerGameRecord.count({
      where: {
        cachedPlayerId,
        gameRecord: { source: NATIVE_SOURCE },
      },
    })) > 0
  );
}

async function getStatisticsWithFallback(input: {
  host: string;
  state: NonNullable<Awaited<ReturnType<typeof getPublicPlayerState>>>;
  native: boolean;
}) {
  if (input.native) return getNativeStatistics(input.state);

  try {
    return await getPublicPlayerStatistics(input);
  } catch (reason) {
    console.warn("Serving player detail without fresh upstream statistics", reason);
    return (
      (await getCachedPublicPlayerStatistics(input.state)) ?? {
        metadata: null,
        extendedStats: null,
      }
    );
  }
}

export const GET: RequestHandler = async (event) => {
  const playerId = event.params.id?.trim();
  if (!playerId || !/^\d+$/.test(playerId)) {
    return json({ message: "올바른 플레이어 ID가 필요합니다." }, { status: 400 });
  }

  try {
    await runPublicPlayerCacheMaintenance();
    const range = parseRange(event.url);
    const cached = await getPublicPlayerState({ playerId, ...range });
    const native = cached ? await hasNativePlayerRecords(cached.player.id) : false;
    const shouldRefresh =
      !native &&
      event.url.searchParams.get("refresh") !== "0" &&
      (!cached || !cached.rangeCovered || cached.stale);

    let state = cached;
    if (shouldRefresh) {
      try {
        state = await refreshPublicPlayer({
          host: event.url.host,
          playerId,
          ...range,
        });
      } catch (reason) {
        if (!cached) throw reason;
        console.warn("Serving cached player detail after upstream refresh failed", reason);
        state = cached;
      }
    }

    if (!state) {
      return json({ message: "플레이어 정보를 찾지 못했습니다." }, { status: 404 });
    }

    const statistics = await getStatisticsWithFallback({
      host: event.url.host,
      state,
      native,
    });
    return json(serializeState(state, statistics));
  } catch (reason) {
    return errorResponse(reason);
  }
};

export const POST: RequestHandler = async (event) => {
  const playerId = event.params.id?.trim();
  if (!playerId || !/^\d+$/.test(playerId)) {
    return json({ message: "올바른 플레이어 ID가 필요합니다." }, { status: 400 });
  }

  try {
    await runPublicPlayerCacheMaintenance();
    const range = parseRange(event.url);
    const cached = await getPublicPlayerState({ playerId, ...range });
    const native = cached ? await hasNativePlayerRecords(cached.player.id) : false;

    if (cached && native) {
      return json(serializeState(cached, getNativeStatistics(cached)));
    }

    const state = await refreshPublicPlayer({
      host: event.url.host,
      playerId,
      ...range,
      force: true,
    });

    if (!state) {
      return json({ message: "플레이어 정보를 찾지 못했습니다." }, { status: 404 });
    }

    const statistics = await getPublicPlayerStatistics({
      host: event.url.host,
      state,
      force: true,
    });
    return json(serializeState(state, statistics));
  } catch (reason) {
    return errorResponse(reason);
  }
};
