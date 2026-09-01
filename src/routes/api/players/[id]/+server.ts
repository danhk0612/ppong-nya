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

function readPlayerLevel(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return 0;
  if ("level" in metadata) return Number(metadata.level) || 0;
  if ("levelId" in metadata) return Number(metadata.levelId) || 0;
  return 0;
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
  metadata: null;
  extendedStats: null;
};

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
  if (input.native) {
    return { metadata: null, extendedStats: null };
  }

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
      return json(
        serializeState(cached, { metadata: null, extendedStats: null }),
      );
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
