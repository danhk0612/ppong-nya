import { requireApiSession } from "$lib/server/auth";
import {
  optionalPrismaJson,
  optionalString,
  readJsonObject,
  requireString,
} from "$lib/server/api";
import { db } from "$lib/server/db";
import { requireOwnedResource } from "$lib/server/ownership";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
  const session = await requireApiSession(event);
  const favorites = await db.favoritePlayer.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  const snapshots = favorites.length
    ? await db.playerSnapshot.findMany({
        where: {
          userId: session.user.id,
          playerId: { in: favorites.map((favorite) => favorite.playerId) },
          scope: { in: ["stats", "records"] },
        },
        orderBy: { computedAt: "desc" },
      })
    : [];
  const snapshotsByPlayer = new Map<string, (typeof snapshots)[number][]>();
  for (const snapshot of snapshots) {
    const playerSnapshots = snapshotsByPlayer.get(snapshot.playerId) ?? [];
    playerSnapshots.push(snapshot);
    snapshotsByPlayer.set(snapshot.playerId, playerSnapshots);
  }

  return json({
    favorites: favorites.map((favorite) => {
      const playerSnapshots = snapshotsByPlayer.get(favorite.playerId) ?? [];
      const snapshot = playerSnapshots.find(
        (candidate) => candidate.scope === "stats",
      );
      const lastSnapshot = playerSnapshots[0];
      const snapshotPayload =
        snapshot?.payload &&
        typeof snapshot.payload === "object" &&
        !Array.isArray(snapshot.payload)
          ? snapshot.payload
          : null;
      const favoriteMetadata =
        favorite.metadata &&
        typeof favorite.metadata === "object" &&
        !Array.isArray(favorite.metadata)
          ? favorite.metadata
          : null;

      return {
        id: favorite.id,
        playerId: favorite.playerId,
        nickname: favorite.nickname,
        currentLevel: snapshotPayload?.level ?? favoriteMetadata?.level ?? null,
        lastRefreshedAt:
          lastSnapshot?.computedAt.toISOString() ??
          (typeof favoriteMetadata?.lastRefreshedAt === "string"
            ? favoriteMetadata.lastRefreshedAt
            : null),
        updatedAt: favorite.updatedAt,
      };
    }),
  });
};

export const POST: RequestHandler = async (event) => {
  const session = await requireApiSession(event);
  const body = await readJsonObject(event);
  const playerId = requireString(body, "playerId", "플레이어 ID");
  const nickname = requireString(body, "nickname", "닉네임");

  const favorite = await db.favoritePlayer.upsert({
    where: { userId_playerId: { userId: session.user.id, playerId } },
    create: {
      userId: session.user.id,
      playerId,
      nickname,
      displayName: optionalString(body, "displayName"),
      server: optionalString(body, "server"),
      memo: optionalString(body, "memo"),
      metadata: optionalPrismaJson(body, "metadata"),
    },
    update: {
      nickname,
      displayName: optionalString(body, "displayName"),
      server: optionalString(body, "server"),
      memo: optionalString(body, "memo"),
      metadata: optionalPrismaJson(body, "metadata"),
    },
  });

  return json({ favorite }, { status: 201 });
};

export const PATCH: RequestHandler = async (event) => {
  const session = await requireApiSession(event);
  const body = await readJsonObject(event);
  const id = requireString(body, "id", "즐겨찾기 ID");

  await requireOwnedResource(
    db.favoritePlayer,
    session.user.id,
    id,
    "즐겨찾기를 찾을 수 없습니다.",
  );

  const favorite = await db.favoritePlayer.update({
    where: { id, userId: session.user.id },
    data: {
      playerId: optionalString(body, "playerId"),
      nickname: optionalString(body, "nickname"),
      displayName: optionalString(body, "displayName"),
      server: optionalString(body, "server"),
      memo: optionalString(body, "memo"),
      metadata: optionalPrismaJson(body, "metadata"),
    },
  });

  return json({ favorite });
};

export const DELETE: RequestHandler = async (event) => {
  const session = await requireApiSession(event);
  const body = await readJsonObject(event);
  const id = requireString(body, "id", "즐겨찾기 ID");

  await requireOwnedResource(
    db.favoritePlayer,
    session.user.id,
    id,
    "즐겨찾기를 찾을 수 없습니다.",
  );

  await db.favoritePlayer.delete({ where: { id, userId: session.user.id } });

  return json({ ok: true });
};
