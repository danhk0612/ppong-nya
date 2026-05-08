import { requireApiSession } from "$lib/server/auth";
import {
  prismaJsonOrNull,
  readJsonObject,
  requireString,
} from "$lib/server/api";
import { db } from "$lib/server/db";
import { requireOwnedResource } from "$lib/server/ownership";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
  const session = await requireApiSession(event);
  const preferences = await db.userPreference.findMany({
    where: { userId: session.user.id },
    orderBy: { key: "asc" },
  });

  return json({ preferences });
};

export const POST: RequestHandler = async (event) => {
  const session = await requireApiSession(event);
  const body = await readJsonObject(event);
  const key = requireString(body, "key", "설정 키");
  const value = prismaJsonOrNull(body, "value");

  const preference = await db.userPreference.upsert({
    where: { userId_key: { userId: session.user.id, key } },
    create: { userId: session.user.id, key, value },
    update: { value },
  });

  return json({ preference }, { status: 201 });
};

export const PATCH: RequestHandler = async (event) => {
  const session = await requireApiSession(event);
  const body = await readJsonObject(event);
  const id = requireString(body, "id", "설정 ID");
  const value = prismaJsonOrNull(body, "value");

  await requireOwnedResource(
    db.userPreference,
    session.user.id,
    id,
    "설정을 찾을 수 없습니다.",
  );

  const preference = await db.userPreference.update({
    where: { id, userId: session.user.id },
    data: { value },
  });

  return json({ preference });
};

export const DELETE: RequestHandler = async (event) => {
  const session = await requireApiSession(event);
  const body = await readJsonObject(event);
  const id = requireString(body, "id", "설정 ID");

  await requireOwnedResource(
    db.userPreference,
    session.user.id,
    id,
    "설정을 찾을 수 없습니다.",
  );

  await db.userPreference.delete({ where: { id, userId: session.user.id } });

  return json({ ok: true });
};
