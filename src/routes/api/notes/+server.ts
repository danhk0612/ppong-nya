import { requireGoogleApiSession } from "$lib/server/auth";
import {
  optionalPrismaJson,
  optionalString,
  readJsonObject,
  requireString,
} from "$lib/server/api";
import { db } from "$lib/server/db";
import { requireOwnedResource } from "$lib/server/ownership";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

async function verifyOwnedGameRecord(userId: string, gameRecordId?: string) {
  if (!gameRecordId) {
    return undefined;
  }

  const record = await db.gameRecord.findFirst({
    where: { id: gameRecordId, userId },
  });

  if (!record) {
    error(404, "연결할 대국 기록을 찾을 수 없습니다.");
  }

  return gameRecordId;
}

export const GET: RequestHandler = async (event) => {
  const session = await requireGoogleApiSession(event);
  const notes = await db.gameNote.findMany({
    where: { userId: session.user.id },
    include: {
      gameRecord: {
        select: { id: true, mode: true, startedAt: true, tableName: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return json({ notes });
};

export const POST: RequestHandler = async (event) => {
  const session = await requireGoogleApiSession(event);
  const body = await readJsonObject(event);
  const gameRecordId = await verifyOwnedGameRecord(
    session.user.id,
    optionalString(body, "gameRecordId"),
  );

  const note = await db.gameNote.create({
    data: {
      userId: session.user.id,
      gameRecordId,
      title: requireString(body, "title", "메모 제목"),
      body: requireString(body, "body", "메모 본문"),
      tags: optionalPrismaJson(body, "tags"),
    },
  });

  return json({ note }, { status: 201 });
};

export const PATCH: RequestHandler = async (event) => {
  const session = await requireGoogleApiSession(event);
  const body = await readJsonObject(event);
  const id = requireString(body, "id", "메모 ID");
  await requireOwnedResource(
    db.gameNote,
    session.user.id,
    id,
    "메모를 찾을 수 없습니다.",
  );

  const gameRecordId = await verifyOwnedGameRecord(
    session.user.id,
    optionalString(body, "gameRecordId"),
  );

  const note = await db.gameNote.update({
    where: { id, userId: session.user.id },
    data: {
      gameRecordId,
      title: optionalString(body, "title"),
      body: optionalString(body, "body"),
      tags: optionalPrismaJson(body, "tags"),
    },
  });

  return json({ note });
};

export const DELETE: RequestHandler = async (event) => {
  const session = await requireGoogleApiSession(event);
  const body = await readJsonObject(event);
  const id = requireString(body, "id", "메모 ID");

  await requireOwnedResource(
    db.gameNote,
    session.user.id,
    id,
    "메모를 찾을 수 없습니다.",
  );

  await db.gameNote.delete({ where: { id, userId: session.user.id } });

  return json({ ok: true });
};
