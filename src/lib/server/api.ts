import { Prisma } from "@prisma/client";
import { error, type RequestEvent } from "@sveltejs/kit";

export async function readJsonObject(event: RequestEvent) {
  let body: unknown;

  try {
    body = await event.request.json();
  } catch {
    error(400, "유효한 JSON 본문이 필요합니다.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    error(400, "JSON 객체 본문이 필요합니다.");
  }

  return body as Record<string, unknown>;
}

export function requireString(
  body: Record<string, unknown>,
  key: string,
  label = key,
) {
  const value = body[key];

  if (typeof value !== "string" || !value.trim()) {
    error(400, `${label} 값이 필요합니다.`);
  }

  return value.trim();
}

export function optionalString(body: Record<string, unknown>, key: string) {
  const value = body[key];

  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    error(400, `${key} 값은 문자열이어야 합니다.`);
  }

  return value.trim();
}

export function optionalInt(body: Record<string, unknown>, key: string) {
  const value = body[key];

  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numeric = Number(value);

  if (!Number.isInteger(numeric)) {
    error(400, `${key} 값은 정수여야 합니다.`);
  }

  return numeric;
}

export function optionalDate(body: Record<string, unknown>, key: string) {
  const value = optionalString(body, key);

  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    error(400, `${key} 값은 유효한 날짜여야 합니다.`);
  }

  return date;
}

export function optionalJson(body: Record<string, unknown>, key: string) {
  const value = body[key];

  return value === undefined ? undefined : value;
}

export function optionalPrismaJson(body: Record<string, unknown>, key: string) {
  const value = optionalJson(body, key);

  if (value === undefined) {
    return undefined;
  }

  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

export function prismaJsonOrNull(body: Record<string, unknown>, key: string) {
  return optionalPrismaJson(body, key) ?? Prisma.JsonNull;
}
