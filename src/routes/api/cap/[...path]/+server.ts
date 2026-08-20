import { error, type RequestHandler } from "@sveltejs/kit";

const CAP_API_ENDPOINT = "https://akcap.pikapika.me/14f343ec68/";
const CAP_ORIGIN = "https://amae-koromo.sapk.ch";
const CAP_USER_AGENT =
  "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const ALLOWED_PATHS = new Set(["challenge", "redeem"]);

export const POST: RequestHandler = async (event) => {
  const path = event.params.path ?? "";

  if (!ALLOWED_PATHS.has(path)) {
    error(404, "Unsupported CAP endpoint.");
  }

  const headers = new Headers();
  const contentType = event.request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  headers.set("accept", "*/*");
  headers.set("accept-language", "ko-KR,ko;q=0.9,en;q=0.8");
  headers.set("origin", CAP_ORIGIN);
  headers.set("referer", `${CAP_ORIGIN}/`);
  headers.set("sec-fetch-dest", "empty");
  headers.set("sec-fetch-mode", "cors");
  headers.set("sec-fetch-site", "cross-site");
  headers.set("user-agent", CAP_USER_AGENT);

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
