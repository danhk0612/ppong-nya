import { json } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import {
  getDefaultPublicPlayerRange,
  getPublicPlayerState,
} from "$lib/server/services/publicPlayerCache";
import { runPublicPlayerCacheMaintenance } from "$lib/server/services/publicPlayerRetention";
import type { RequestHandler } from "./$types";

const NATIVE_SOURCE = "majsoul-native";
const ROUND_STAT_KEYS = [
  "rounds",
  "wins",
  "tsumoWins",
  "dealIns",
  "riichiRounds",
  "openRounds",
  "draws",
  "winPointSum",
  "dealInPointSum",
] as const;

type RoundStats = Record<(typeof ROUND_STAT_KEYS)[number], number>;
type PlayerState = NonNullable<Awaited<ReturnType<typeof getPublicPlayerState>>>;
type PlayerRecordLink = PlayerState["records"][number];

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

function readRoundStats(metadata: unknown): Partial<RoundStats> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, unknown>).roundStats;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const result: Partial<RoundStats> = {};
  for (const key of ROUND_STAT_KEYS) {
    const value = Number((raw as Record<string, unknown>)[key]);
    if (Number.isFinite(value)) result[key] = value;
  }
  return result;
}

function nativeRecords(state: PlayerState) {
  return state.records.filter(({ gameRecord }) => gameRecord.source === NATIVE_SOURCE);
}

function serializeRecord(link: PlayerRecordLink) {
  const { gameRecord } = link;
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

function getNativeStatistics(state: PlayerState) {
  const playerId = state.player.playerId;
  const entries = nativeRecords(state)
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
  const roundTotals = Object.fromEntries(ROUND_STAT_KEYS.map((key) => [key, 0])) as RoundStats;
  let roundStatsGames = 0;

  for (const { player } of entries) {
    const index = Math.max(0, Math.min(3, player.placement - 1));
    rankCounts[index] += 1;
    rankScoreSums[index] += player.score;

    const roundStats = readRoundStats(player.metadata);
    if (roundStats) {
      roundStatsGames += 1;
      for (const key of ROUND_STAT_KEYS) {
        roundTotals[key] += Number(roundStats[key] ?? 0);
      }
    }
  }

  const count = entries.length;
  const latest = entries[0].player;
  const latestLevelId = readNumericMetadata(latest.metadata, "levelId") ?? state.player.level ?? 10101;
  const latestLevelScore = readNumericMetadata(latest.metadata, "levelScore") ?? 0;
  const latestDelta = latest.ratingDelta == null ? 0 : Number(latest.ratingDelta);
  const maxLevelId = state.player.maxLevel ?? latestLevelId;
  const rounds = roundTotals.rounds;

  const extendedStats = rounds > 0 && roundStatsGames > 0
    ? {
        count: rounds,
        和牌率: roundTotals.wins / rounds,
        自摸率: roundTotals.wins ? roundTotals.tsumoWins / roundTotals.wins : 0,
        放铳率: roundTotals.dealIns / rounds,
        副露率: roundTotals.openRounds / rounds,
        立直率: roundTotals.riichiRounds / rounds,
        平均打点: roundTotals.wins ? roundTotals.winPointSum / roundTotals.wins : 0,
        平均铳点: roundTotals.dealIns ? roundTotals.dealInPointSum / roundTotals.dealIns : 0,
        流局率: roundTotals.draws / rounds,
      }
    : null;

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
    extendedStats,
  };
}

function serializeState(state: PlayerState) {
  return {
    player: {
      ...state.player,
      latestTimestamp:
        state.player.latestTimestamp == null
          ? null
          : Number(state.player.latestTimestamp),
    },
    records: nativeRecords(state).map(serializeRecord),
    modeKey: state.modeKey,
    periodStart: state.periodStart,
    periodEnd: state.periodEnd,
    rangeCovered: state.rangeCovered,
    stale: state.stale,
    statistics: getNativeStatistics(state),
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

async function serveNativePlayer(event: Parameters<RequestHandler>[0]) {
  const playerId = event.params.id?.trim();
  if (!playerId || !/^\d+$/.test(playerId)) {
    return json({ message: "올바른 플레이어 ID가 필요합니다." }, { status: 400 });
  }

  try {
    await runPublicPlayerCacheMaintenance();
    const state = await getPublicPlayerState({ playerId, ...parseRange(event.url) });
    if (!state || !(await hasNativePlayerRecords(state.player.id))) {
      return json(
        { message: "아직 수집된 4인전 기록이 없는 플레이어입니다." },
        { status: 404 },
      );
    }
    return json(serializeState(state));
  } catch (reason) {
    return errorResponse(reason);
  }
}

export const GET: RequestHandler = serveNativePlayer;
export const POST: RequestHandler = serveNativePlayer;
