import { requireGoogleApiSession } from "$lib/server/auth";
import { readJsonObject, requireString, optionalJson } from "$lib/server/api";
import { db } from "$lib/server/db";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
  const session = await requireGoogleApiSession(event);
  const preferences = await db.userPreference.findMany({
    where: { userId: session.user.id },
    orderBy: { key: "asc" },
  });

  return json({ preferences });
};

export const POST: RequestHandler = async (event) => {
  const session = await requireGoogleApiSession(event);
  const body = await readJsonObject(event);
  const key = requireString(body, "key", "설정 키");
  const value = optionalJson(body, "value") ?? null;

  const preference = await db.userPreference.upsert({
    where: { userId_key: { userId: session.user.id, key } },
    create: { userId: session.user.id, key, value },
    update: { value },
  });

  return json({ preference }, { status: 201 });
};

export const PATCH: RequestHandler = async (event) => {
  const session = await requireGoogleApiSession(event);
  const body = await readJsonObject(event);
  const id = requireString(body, "id", "설정 ID");
  const value = optionalJson(body, "value") ?? null;

  const preference = await db.userPreference.update({
    where: { id, userId: session.user.id },
    data: { value },
  });

  return json({ preference });
};

export const DELETE: RequestHandler = async (event) => {
  const session = await requireGoogleApiSession(event);
  const body = await readJsonObject(event);
  const id = requireString(body, "id", "설정 ID");

  await db.userPreference.delete({ where: { id, userId: session.user.id } });

  return json({ ok: true });
};
