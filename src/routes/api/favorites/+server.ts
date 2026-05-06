import { requireGoogleApiSession } from "$lib/server/auth";
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
  const session = await requireGoogleApiSession(event);
  const favorites = await db.favoritePlayer.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  return json({ favorites });
};

export const POST: RequestHandler = async (event) => {
  const session = await requireGoogleApiSession(event);
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
  const session = await requireGoogleApiSession(event);
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
  const session = await requireGoogleApiSession(event);
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
