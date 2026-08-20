import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const session = await event.locals.auth();

  if (session?.user) {
    redirect(303, "/account");
  }

  const requestedReturnTo = event.url.searchParams.get("returnTo");
  const returnTo =
    requestedReturnTo?.startsWith("/") && !requestedReturnTo.startsWith("//")
      ? requestedReturnTo
      : "/account";

  return { returnTo };
};
