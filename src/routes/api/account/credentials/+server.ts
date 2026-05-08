import { error, json } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { requireApiSession } from "$lib/server/auth";
import {
  hashPassword,
  validatePassword,
  verifyPassword,
} from "$lib/server/password";
import type { RequestHandler } from "./$types";

type CredentialsUpdateRequest = {
  email?: string;
  name?: string;
  currentPassword?: string;
  newPassword?: string;
};

export const PUT: RequestHandler = async (event) => {
  const session = await requireApiSession(event);
  const body = (await event.request
    .json()
    .catch(() => ({}))) as CredentialsUpdateRequest;
  const email = normalizeEmail(body.email);
  const name = body.name?.trim() || null;
  const newPassword = body.newPassword ?? "";
  const currentPassword = body.currentPassword ?? "";

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
      passwordChangeRequired: true,
    },
  });

  if (!user) {
    error(404, "사용자를 찾을 수 없습니다.");
  }

  if (!email) {
    error(400, "변경할 이메일 아이디를 입력해 주세요.");
  }

  if (!newPassword) {
    error(400, "새 비밀번호를 입력해 주세요.");
  }

  const passwordError = validatePassword(newPassword);

  if (passwordError) {
    error(400, passwordError);
  }

  if (user.passwordChangeRequired) {
    if (email === user.email.toLowerCase()) {
      error(
        400,
        "최초 관리자 로그인 후에는 이메일 아이디를 반드시 변경해야 합니다.",
      );
    }
  } else if (!verifyPassword(currentPassword, user.passwordHash)) {
    error(401, "현재 비밀번호가 올바르지 않습니다.");
  }

  const updatedUser = await db.user
    .update({
      where: { id: user.id },
      data: {
        email,
        name,
        passwordHash: hashPassword(newPassword),
        passwordChangeRequired: false,
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
        error(409, "이미 사용 중인 이메일입니다.");
      }

      throw cause;
    });

  return json({ user: updatedUser });
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
