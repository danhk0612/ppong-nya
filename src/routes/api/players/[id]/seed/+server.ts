import { json } from "@sveltejs/kit";
import { touchCachedPlayer } from "$lib/server/services/publicPlayerCache";
import type { RequestHandler } from "./$types";

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export const POST: RequestHandler = async (event) => {
  const playerId = event.params.id?.trim();
  if (!playerId || !/^\d+$/.test(playerId)) {
    return json({ message: "올바른 플레이어 ID가 필요합니다." }, { status: 400 });
  }

  const body = await event.request.json().catch(() => null);
  const nickname =
    body && typeof body === "object" && "nickname" in body
      ? String(body.nickname).trim()
      : "";

  if (!nickname) {
    return json({ message: "플레이어 닉네임이 필요합니다." }, { status: 400 });
  }

  const level =
    body && typeof body === "object" && "level" in body
      ? numberOrNull(body.level)
      : null;
  const latestTimestamp =
    body && typeof body === "object" && "latestTimestamp" in body
      ? numberOrNull(body.latestTimestamp)
      : null;

  await touchCachedPlayer({
    playerId,
    nickname,
    level,
    latestTimestamp,
  });

  return json({ ok: true });
};
