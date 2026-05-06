import { requireApiSession } from "$lib/server/auth";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
  const session = await requireApiSession(event);

  return json({ user: session.user });
};
