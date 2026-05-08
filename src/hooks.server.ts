import { sequence } from "@sveltejs/kit/hooks";
import { handle as authHandle } from "./auth";
import { isProductionRuntime, productionOrigin } from "$lib/server/env";
import { ensureDefaultAdmin } from "$lib/server/defaultAdmin";
import { error, redirect, type Handle } from "@sveltejs/kit";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const PASSWORD_CHANGE_ALLOWED_PATHS = new Set([
  "/account",
  "/api/account/credentials",
  "/api/auth/logout",
  "/api/auth/session",
]);

const trustedOriginHandle: Handle = async ({ event, resolve }) => {
  if (isProductionRuntime && !SAFE_METHODS.has(event.request.method)) {
    const origin = event.request.headers.get("origin");

    if (origin && origin !== productionOrigin) {
      error(403, "신뢰할 수 없는 요청 출처입니다.");
    }
  }

  return resolve(event);
};

const defaultAdminHandle: Handle = async ({ event, resolve }) => {
  await ensureDefaultAdmin();

  return resolve(event);
};

const requiredPasswordChangeHandle: Handle = async ({ event, resolve }) => {
  const session = await event.locals.auth();

  if (
    session?.user?.passwordChangeRequired &&
    !PASSWORD_CHANGE_ALLOWED_PATHS.has(event.url.pathname)
  ) {
    if (event.url.pathname.startsWith("/api/")) {
      error(
        403,
        "계속하려면 먼저 관리자 이메일 아이디와 비밀번호를 변경해야 합니다.",
      );
    }

    redirect(303, "/account");
  }

  return resolve(event);
};

export const handle = sequence(
  trustedOriginHandle,
  defaultAdminHandle,
  authHandle,
  requiredPasswordChangeHandle,
);
