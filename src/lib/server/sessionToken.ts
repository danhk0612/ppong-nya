import type { Cookies } from "@sveltejs/kit";

const SESSION_COOKIE_PREFIXES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
] as const;

export function getAuthSessionToken(cookies: Cookies) {
  const allCookies = cookies.getAll();

  for (const prefix of SESSION_COOKIE_PREFIXES) {
    const directCookie = allCookies.find((cookie) => cookie.name === prefix);

    if (directCookie?.value) {
      return directCookie.value;
    }

    const chunkedValue = allCookies
      .filter((cookie) => cookie.name.startsWith(`${prefix}.`) && cookie.value)
      .sort(
        (left, right) =>
          getCookieChunkIndex(left.name) - getCookieChunkIndex(right.name),
      )
      .map((cookie) => cookie.value)
      .join("");

    if (chunkedValue) {
      return chunkedValue;
    }
  }

  return undefined;
}

export function clearAuthSessionCookies(cookies: Cookies) {
  for (const cookie of cookies.getAll()) {
    if (
      SESSION_COOKIE_PREFIXES.some(
        (prefix) =>
          cookie.name === prefix || cookie.name.startsWith(`${prefix}.`),
      )
    ) {
      cookies.delete(cookie.name, { path: "/" });
    }
  }
}

function getCookieChunkIndex(name: string) {
  const suffix = name.split(".").at(-1);
  const index = suffix ? Number.parseInt(suffix, 10) : 0;

  return Number.isNaN(index) ? 0 : index;
}
