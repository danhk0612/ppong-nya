import { apiGetFresh } from "../data/source/api";
import { GameMode } from "../data/types/gameMode";
import type {
  PlayerExtendedStats,
  PlayerMetadata,
} from "../data/types/metadata";
import type { GameRecord } from "../data/types/record";

const YONMA_MODES = [
  GameMode.王座,
  GameMode.玉,
  GameMode.金,
  GameMode.王东,
  GameMode.玉东,
  GameMode.金东,
];

export type FavoriteSyncState = {
  playerId: string;
  metadata: PlayerMetadata | null;
  extendedStats: PlayerExtendedStats | null;
  records: GameRecord[];
  lastRefreshedAt: string | null;
  needsStatsRefresh: boolean;
  needsRecordsRefresh: boolean;
};

export async function getFavoriteSyncState(
  playerId: string,
  init?: RequestInit,
) {
  const response = await fetch(
    `/api/favorites/sync?playerId=${encodeURIComponent(playerId)}`,
    init,
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => undefined);
    throw new Error(payload?.message ?? "저장된 전적을 불러오지 못했습니다.");
  }

  return (await response.json()) as FavoriteSyncState;
}

export async function syncFavoritePlayer(playerId: string) {
  const state = await getFavoriteSyncState(playerId);

  if (!state.needsStatsRefresh && !state.needsRecordsRefresh) {
    return state;
  }

  const startMillis = new Date("2010-01-01T00:00:00.000").getTime();
  const endMillis = Date.now();
  const mode = YONMA_MODES.join(".");
  const hourTag = Math.floor(Date.now() / 3_600_000);

  let metadata = state.metadata;
  let extendedStats = state.extendedStats;
  let records: GameRecord[] | undefined;

  if (state.needsStatsRefresh) {
    const params = `${playerId}/${startMillis}/${endMillis}?mode=${mode}&tag=${hourTag}`;
    [metadata, extendedStats] = await Promise.all([
      apiGetFresh<PlayerMetadata>(`player_stats/${params}`),
      apiGetFresh<PlayerExtendedStats>(`player_extended_stats/${params}`),
    ]);
  }

  if (state.needsRecordsRefresh) {
    records = await apiGetFresh<GameRecord[]>(
      `player_records/${playerId}/${endMillis}/${startMillis}?limit=30&mode=${mode}&descending=true&tag=${metadata?.count ?? ""}`,
    );
  }

  return getFavoriteSyncState(playerId, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      metadata: state.needsStatsRefresh ? metadata : undefined,
      extendedStats: state.needsStatsRefresh ? extendedStats : undefined,
      records,
    }),
  });
}
