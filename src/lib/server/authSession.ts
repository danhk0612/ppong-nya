import { randomBytes } from "node:crypto";
import { dev } from "$app/environment";
import type { Cookies } from "@sveltejs/kit";
import { db } from "$lib/server/db";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SESSION_COOKIE_NAME = dev
  ? "authjs.session-token"
  : "__Secure-authjs.session-token";

export async function createDatabaseSession(userId: string, cookies: Cookies) {
  const sessionToken = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.session.create({
    data: {
      sessionToken,
      userId,
      expires,
    },
  });

  cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: !dev,
    expires,
  });

  return { sessionToken, expires };
}
