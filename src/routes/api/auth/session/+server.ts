import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
  const session = await event.locals.auth();

  return json({ authenticated: Boolean(session?.user), session });
};
