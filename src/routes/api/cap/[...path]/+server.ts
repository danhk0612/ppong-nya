import { error, type RequestHandler } from "@sveltejs/kit";

const CAP_API_ENDPOINT = "https://akcap.pikapika.me/14f343ec68/";
const CAP_ORIGIN = "https://amae-koromo.sapk.ch";
const ALLOWED_PATHS = new Set(["challenge", "redeem"]);

export const POST: RequestHandler = async (event) => {
  const path = event.params.path ?? "";

  if (!ALLOWED_PATHS.has(path)) {
    error(404, "Unsupported CAP endpoint.");
  }

  const headers = new Headers(event.request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  headers.delete("cookie");
  headers.delete("authorization");
  headers.delete("sec-fetch-dest");
  headers.delete("sec-fetch-mode");
  headers.delete("sec-fetch-site");
  headers.set("origin", CAP_ORIGIN);
  headers.set("referer", `${CAP_ORIGIN}/`);

  const requestBody = await event.request.text();
  const response = await fetch(`${CAP_API_ENDPOINT}${path}`, {
    method: "POST",
    body: requestBody || undefined,
    headers,
  });
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-length");
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("transfer-encoding");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
};
