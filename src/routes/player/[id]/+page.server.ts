import { error, redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, url }) => {
  const key = params.id.trim();
  if (!key) {
    error(404, "플레이어를 찾을 수 없습니다.");
  }

  if (/^\d+$/.test(key)) {
    return { playerId: key };
  }

  const matches = await db.cachedPlayer.findMany({
    where: {
      nickname: key,
      gameRecords: {
        some: { gameRecord: { source: "majsoul-native" } },
      },
    },
    orderBy: [{ lastUpdatedAt: "desc" }, { latestTimestamp: "desc" }],
    take: 2,
  });

  if (!matches.length) {
    error(404, "일치하는 플레이어를 찾지 못했습니다.");
  }

  if (matches.length === 1) {
    redirect(307, `/player/${matches[0].playerId}${url.search}`);
  }

  const searchParams = new URLSearchParams({ q: key });
  redirect(307, `/players?${searchParams.toString()}`);
};
