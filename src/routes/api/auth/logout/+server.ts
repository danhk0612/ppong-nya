import { json } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import {
  clearAuthSessionCookies,
  getAuthSessionToken,
} from "$lib/server/sessionToken";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async (event) => {
  const sessionToken = getAuthSessionToken(event.cookies);
  let deletedSessions = 0;

  if (sessionToken) {
    const result = await db.session.deleteMany({ where: { sessionToken } });
    deletedSessions = result.count;
  }

  clearAuthSessionCookies(event.cookies);

  return json({ authenticated: false, deletedSessions });
};
