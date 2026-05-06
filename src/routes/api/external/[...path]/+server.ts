import { fetchExternalApi } from "$lib/server/services/externalApi";
import type { RequestHandler } from "./$types";

async function proxyExternalApi(event: Parameters<RequestHandler>[0]) {
  const path = `${event.params.path ?? ""}${event.url.search}`;
  const body = event.request.method === "GET" || event.request.method === "HEAD" ? undefined : await event.request.text();
  const headers = new Headers(event.request.headers);

  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  return fetchExternalApi({
    host: event.url.host,
    path,
    method: event.request.method,
    body,
    headers,
  });
}

export const GET: RequestHandler = proxyExternalApi;
export const POST: RequestHandler = proxyExternalApi;
