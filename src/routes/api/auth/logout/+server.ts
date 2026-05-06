import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () => {
  redirect(303, "/auth/signout?callbackUrl=/");
};

export const POST = GET;
