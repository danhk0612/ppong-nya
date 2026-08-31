import { db } from "$lib/server/db";
import { fetchExternalApi } from "$lib/server/services/externalApi";
import { Level } from "../../../data/types/level";

type ExternalSearchResult = {
  id: number;
  nickname: string;
  level: { id: number };
  latest_timestamp: number;
};

export type PublicPlayerMatch = {
  playerId: string;
  nickname: string;
  levelId: number | null;
  latestTimestamp: number | null;
  source: "local" | "external";
};

function normalizedName(value: string) {
  return value.trim().toLocaleLowerCase();
}

async function searchExternal(host: string, nickname: string) {
  const response = await fetchExternalApi({
    host,
    path: `search_player/${encodeURIComponent(nickname)}?limit=20&tag=all`,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String(payload.message)
        : "플레이어 검색 서버에 연결하지 못했습니다.";
    throw Object.assign(new Error(message), { status: response.status });
  }

  const target = normalizedName(nickname);
  return ((Array.isArray(payload) ? payload : []) as ExternalSearchResult[])
    .filter(
      (player) =>
        player &&
        typeof player.id === "number" &&
        typeof player.nickname === "string" &&
        player.level &&
        typeof player.level.id === "number" &&
        new Level(player.level.id).getNumPlayerId() === 1 &&
        normalizedName(player.nickname) === target,
    )
    .map<PublicPlayerMatch>((player) => ({
      playerId: String(player.id),
      nickname: player.nickname.trim() || player.nickname,
      levelId: player.level.id,
      latestTimestamp:
        typeof player.latest_timestamp === "number" ? player.latest_timestamp : null,
      source: "external",
    }));
}

export async function resolvePublicPlayerName(input: {
  host: string;
  nickname: string;
}) {
  const nickname = input.nickname.trim();
  if (!nickname) return [];

  const local = await db.cachedPlayer.findMany({
    where: { nickname },
    orderBy: [{ lastUpdatedAt: "desc" }, { latestTimestamp: "desc" }],
  });

  if (local.length) {
    return local.map<PublicPlayerMatch>((player) => ({
      playerId: player.playerId,
      nickname: player.nickname,
      levelId: player.level,
      latestTimestamp:
        player.latestTimestamp == null ? null : Number(player.latestTimestamp),
      source: "local",
    }));
  }

  return searchExternal(input.host, nickname);
}
