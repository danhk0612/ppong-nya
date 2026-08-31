import { json } from "@sveltejs/kit";
import {
  getDefaultPublicPlayerRange,
  getPublicPlayerState,
  refreshPublicPlayer,
} from "$lib/server/services/publicPlayerCache";
import { runPublicPlayerCacheMaintenance } from "$lib/server/services/publicPlayerRetention";
import { getPublicPlayerStatistics } from "$lib/server/services/publicPlayerStatistics";
import type { RequestHandler } from "./$types";

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

function serializeRecord(link: NonNullable<Awaited<ReturnType<typeof getPublicPlayerState>>>["records"][number]) {
  const { gameRecord } = link;
  if (gameRecord.rawPayload) return gameRecord.rawPayload;

  return {
    modeId: gameRecord.externalModeId,
    uuid: gameRecord.uuid,
    startTime: Math.floor(gameRecord.startedAt.getTime() / 1000),
    endTime: Math.floor((gameRecord.endedAt ?? gameRecord.startedAt).getTime() / 1000),
    players: gameRecord.players.map((player) => ({
      accountId: Number(player.accountId),
      nickname: player.nickname,
      level:
        player.metadata &&
        typeof player.metadata === "object" &&
        !Array.isArray(player.metadata) &&
        "level" in player.metadata
          ? Number(player.metadata.level)
          : 0,
      score: player.score,
    })),
  };
}

function serializeState(
  state: NonNullable<Awaited<ReturnType<typeof getPublicPlayerState>>>,
  statistics: Awaited<ReturnType<typeof getPublicPlayerStatistics>>,
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

export const GET: RequestHandler = async (event) => {
  const playerId = event.params.id?.trim();
  if (!playerId || !/^\d+$/.test(playerId)) {
    return json({ message: "올바른 플레이어 ID가 필요합니다." }, { status: 400 });
  }

  try {
    await runPublicPlayerCacheMaintenance();
    const range = parseRange(event.url);
    const cached = await getPublicPlayerState({ playerId, ...range });
    const shouldRefresh =
      event.url.searchParams.get("refresh") !== "0" &&
      (!cached || !cached.rangeCovered || cached.stale);

    const state = shouldRefresh
      ? await refreshPublicPlayer({
          host: event.url.host,
          playerId,
          ...range,
        })
      : cached;

    if (!state) {
      return json({ message: "플레이어 정보를 찾지 못했습니다." }, { status: 404 });
    }

    const statistics = await getPublicPlayerStatistics({
      host: event.url.host,
      state,
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
