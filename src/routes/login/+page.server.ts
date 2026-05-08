import { redirect } from "@sveltejs/kit";
import { privateEnv } from "$lib/server/env";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const session = await event.locals.auth();

  if (session?.user) {
    redirect(303, "/account");
  }

  return {
    googleEnabled: Boolean(
      privateEnv.googleClientId && privateEnv.googleClientSecret,
    ),
  };
};
