import { requireGoogleApiSession } from "$lib/server/auth";
import {
  optionalDate,
  optionalInt,
  optionalJson,
  optionalString,
  readJsonObject,
  requireString,
} from "$lib/server/api";
import { db } from "$lib/server/db";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

type PlayerInput = {
  seat?: unknown;
  accountId?: unknown;
  nickname?: unknown;
  rankLabel?: unknown;
  score?: unknown;
  placement?: unknown;
  ratingDelta?: unknown;
  metadata?: unknown;
};

const gameModes = new Set(["SANMA", "YONMA"]);

function requireGameMode(body: Record<string, unknown>) {
  const mode = requireString(body, "mode", "대국 모드").toUpperCase();

  if (!gameModes.has(mode)) {
    error(400, "대국 모드는 SANMA 또는 YONMA여야 합니다.");
  }

  return mode as "SANMA" | "YONMA";
}

function parsePlayers(body: Record<string, unknown>) {
  const players = body.players;

  if (players === undefined) {
    return undefined;
  }

  if (!Array.isArray(players)) {
    error(400, "players 값은 배열이어야 합니다.");
  }

  return players.map((player: PlayerInput) => {
    if (!player || typeof player !== "object") {
      error(400, "플레이어 정보는 객체여야 합니다.");
    }

    const seat = Number(player.seat);
    const score = Number(player.score);
    const placement = Number(player.placement);

    if (
      !Number.isInteger(seat) ||
      !Number.isInteger(score) ||
      !Number.isInteger(placement)
    ) {
      error(400, "플레이어의 seat, score, placement는 정수여야 합니다.");
    }

    if (typeof player.nickname !== "string" || !player.nickname.trim()) {
      error(400, "플레이어 닉네임이 필요합니다.");
    }

    return {
      seat,
      accountId:
        typeof player.accountId === "string"
          ? player.accountId.trim()
          : undefined,
      nickname: player.nickname.trim(),
      rankLabel:
        typeof player.rankLabel === "string"
          ? player.rankLabel.trim()
          : undefined,
      score,
      placement,
      ratingDelta:
        player.ratingDelta === undefined || player.ratingDelta === null
          ? undefined
          : String(player.ratingDelta),
      metadata: player.metadata,
    };
  });
}

export const GET: RequestHandler = async (event) => {
  const session = await requireGoogleApiSession(event);
  const records = await db.gameRecord.findMany({
    where: { userId: session.user.id },
    include: { players: { orderBy: { seat: "asc" } }, notes: true },
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  return json({ records });
};

export const POST: RequestHandler = async (event) => {
  const session = await requireGoogleApiSession(event);
  const body = await readJsonObject(event);
  const mode = requireGameMode(body);
  const startedAt = optionalDate(body, "startedAt") ?? new Date();
  const players = parsePlayers(body);

  const record = await db.gameRecord.create({
    data: {
      userId: session.user.id,
      externalId: optionalString(body, "externalId"),
      mode,
      startedAt,
      endedAt: optionalDate(body, "endedAt"),
      tableName: optionalString(body, "tableName"),
      rounds: optionalInt(body, "rounds"),
      metadata: optionalJson(body, "metadata"),
      players: players ? { create: players } : undefined,
    },
    include: { players: { orderBy: { seat: "asc" } }, notes: true },
  });

  return json({ record }, { status: 201 });
};

export const PATCH: RequestHandler = async (event) => {
  const session = await requireGoogleApiSession(event);
  const body = await readJsonObject(event);
  const id = requireString(body, "id", "대국 기록 ID");
  const players = parsePlayers(body);

  const record = await db.$transaction(async (tx) => {
    await tx.gameRecord.update({
      where: { id, userId: session.user.id },
      data: {
        externalId: optionalString(body, "externalId"),
        mode: body.mode ? requireGameMode(body) : undefined,
        startedAt: optionalDate(body, "startedAt"),
        endedAt: optionalDate(body, "endedAt"),
        tableName: optionalString(body, "tableName"),
        rounds: optionalInt(body, "rounds"),
        metadata: optionalJson(body, "metadata"),
      },
    });

    if (players) {
      await tx.player.deleteMany({ where: { gameRecordId: id } });
      await tx.player.createMany({
        data: players.map((player) => ({ ...player, gameRecordId: id })),
      });
    }

    return tx.gameRecord.findUniqueOrThrow({
      where: { id, userId: session.user.id },
      include: { players: { orderBy: { seat: "asc" } }, notes: true },
    });
  });

  return json({ record });
};

export const DELETE: RequestHandler = async (event) => {
  const session = await requireGoogleApiSession(event);
  const body = await readJsonObject(event);
  const id = requireString(body, "id", "대국 기록 ID");

  await db.gameRecord.delete({ where: { id, userId: session.user.id } });

  return json({ ok: true });
};
