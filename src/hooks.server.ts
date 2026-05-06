import { sequence } from "@sveltejs/kit/hooks";
import { handle as authHandle } from "./auth";
import { isProductionRuntime, productionOrigin } from "$lib/server/env";
import { error, type Handle } from "@sveltejs/kit";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const trustedOriginHandle: Handle = async ({ event, resolve }) => {
  if (isProductionRuntime && !SAFE_METHODS.has(event.request.method)) {
    const origin = event.request.headers.get("origin");

    if (origin && origin !== productionOrigin) {
      error(403, "신뢰할 수 없는 요청 출처입니다.");
    }
  }

  return resolve(event);
};

export const handle = sequence(trustedOriginHandle, authHandle);
