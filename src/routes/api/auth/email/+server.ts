import { json, error } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { createDatabaseSession } from "$lib/server/authSession";
import {
  hashPassword,
  validatePassword,
  verifyPassword,
} from "$lib/server/password";
import type { RequestHandler } from "./$types";

type EmailAuthRequest = {
  mode?: string;
  email?: string;
  name?: string;
  password?: string;
};

export const POST: RequestHandler = async (event) => {
  const body = (await event.request
    .json()
    .catch(() => ({}))) as EmailAuthRequest;
  const mode = body.mode === "signup" ? "signup" : "login";
  const email = normalizeEmail(body.email);
  const password = body.password ?? "";

  if (!email || !password) {
    error(400, "이메일과 비밀번호를 입력해 주세요.");
  }

  if (mode === "signup") {
    const passwordError = validatePassword(password);

    if (passwordError) {
      error(400, passwordError);
    }

    const user = await db.user
      .create({
        data: {
          email,
          name: body.name?.trim() || null,
          passwordHash: hashPassword(password),
          emailVerified: new Date(),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          passwordChangeRequired: true,
        },
      })
      .catch((cause: unknown) => {
        if (isUniqueConstraintError(cause)) {
          error(409, "이미 가입된 이메일입니다.");
        }

        throw cause;
      });

    await createDatabaseSession(user.id, event.cookies);

    return json({ authenticated: true, user }, { status: 201 });
  }

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
      passwordChangeRequired: true,
    },
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    error(401, "이메일 또는 비밀번호가 올바르지 않습니다.");
  }

  await createDatabaseSession(user.id, event.cookies);

  const { passwordHash: _passwordHash, ...safeUser } = user;
  return json({ authenticated: true, user: safeUser });
};

function normalizeEmail(email: string | undefined) {
  const normalized = email?.trim().toLowerCase();

  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return undefined;
  }

  return normalized;
}

function isUniqueConstraintError(cause: unknown) {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "P2002"
  );
}
