import { requireSession } from "$lib/server/auth";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const session = await requireSession(event);

  return { session, user: session.user };
};
