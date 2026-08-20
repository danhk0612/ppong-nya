import { dev } from "$app/environment";
import { db } from "$lib/server/db";
import type { Prisma } from "@prisma/client";

const DATA_MIRRORS = [
  "https://5-data.amae-koromo.com/",
  "https://1.data.amae-koromo.com/",
  "https://2.data.amae-koromo.com/",
  "https://4.data.amae-koromo.com/",
];
const DEFAULT_API_SUFFIX = dev ? "api-test/v2/pl4/" : "api/v2/pl4/";
const PROBE_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_CACHE_BODY_BYTES = 16 * 1024 * 1024;
const DEFAULT_PUBLIC_HOST = "ppong-nya.mydepot.kr";

let selectedMirror = DATA_MIRRORS[0];
let mirrorProbePromise: Promise<Response> | null = null;

type CachePolicy = {
  pattern: string;
  strategy: "external" | "database";
  cacheTtlSeconds: number | null;
  cacheTable:
    | "ExternalApiCache"
    | "GameRecord"
    | "PlayerSnapshot"
    | "StatisticsSnapshot"
    | null;
  note: string;
};

export const EXTERNAL_API_ENDPOINT_POLICIES = [
  {
    pattern: "search_player/:prefix",
    strategy: "external",
    cacheTtlSeconds: 60 * 60,
    cacheTable: "ExternalApiCache",
    note: "Player lookup remains external initially; cache short-lived search JSON by query.",
  },
  {
    pattern: "player_delta_ranking/:timespan",
    strategy: "external",
    cacheTtlSeconds: 30 * 60,
    cacheTable: "StatisticsSnapshot",
    note: "Ranking deltas are aggregate external data; cache snapshots by timespan.",
  },
  {
    pattern: "career_ranking/:type",
    strategy: "external",
    cacheTtlSeconds: 60 * 60,
    cacheTable: "StatisticsSnapshot",
    note: "Career rankings remain external until the new DB has full historical rankings.",
  },
  {
    pattern: "global_statistics_2",
    strategy: "external",
    cacheTtlSeconds: 60 * 60,
    cacheTable: "StatisticsSnapshot",
    note: "Global aggregate statistics remain external and are cached as snapshots.",
  },
  {
    pattern: "global_statistics_year",
    strategy: "external",
    cacheTtlSeconds: 6 * 60 * 60,
    cacheTable: "StatisticsSnapshot",
    note: "Yearly global statistics are stable enough for longer snapshot caching.",
  },
  {
    pattern: "global_statistics_snapshot/:date",
    strategy: "external",
    cacheTtlSeconds: 24 * 60 * 60,
    cacheTable: "StatisticsSnapshot",
    note: "Dated global statistics snapshots are immutable after upstream publishes them.",
  },
  {
    pattern: "level_statistics",
    strategy: "external",
    cacheTtlSeconds: 6 * 60 * 60,
    cacheTable: "StatisticsSnapshot",
    note: "Level distributions remain external aggregate data and are cached.",
  },
  {
    pattern: "global_histogram",
    strategy: "external",
    cacheTtlSeconds: 6 * 60 * 60,
    cacheTable: "StatisticsSnapshot",
    note: "Global histograms remain external aggregate data and are cached.",
  },
  {
    pattern: "fan_stats",
    strategy: "external",
    cacheTtlSeconds: 6 * 60 * 60,
    cacheTable: "StatisticsSnapshot",
    note: "Fan statistics remain external aggregate data and are cached.",
  },
  {
    pattern: "rank_rate_by_seat",
    strategy: "external",
    cacheTtlSeconds: 6 * 60 * 60,
    cacheTable: "StatisticsSnapshot",
    note: "Seat/rank rates remain external aggregate data and are cached.",
  },
  {
    pattern: "recent_highlight_games",
    strategy: "database",
    cacheTtlSeconds: 10 * 60,
    cacheTable: "GameRecord",
    note: "Highlights should be served from GameRecord after ingestion; proxy fallback is cached during migration.",
  },
  {
    pattern: "games_by_id/:ids",
    strategy: "database",
    cacheTtlSeconds: 24 * 60 * 60,
    cacheTable: "GameRecord",
    note: "Record lookups should be resolved from GameRecord by external ID/UUID after ingestion.",
  },
  {
    pattern: "games/:cursor/:start",
    strategy: "database",
    cacheTtlSeconds: 5 * 60,
    cacheTable: "GameRecord",
    note: "Listing pages should use GameRecord ranges once backfill jobs are in place.",
  },
  {
    pattern: "player_stats/:playerId",
    strategy: "database",
    cacheTtlSeconds: 60 * 60,
    cacheTable: "PlayerSnapshot",
    note: "Player summaries should come from PlayerSnapshot computed from local records.",
  },
  {
    pattern: "player_extended_stats/:playerId",
    strategy: "database",
    cacheTtlSeconds: 60 * 60,
    cacheTable: "PlayerSnapshot",
    note: "Extended player summaries should be materialized as PlayerSnapshot payloads.",
  },
  {
    pattern: "player_records/:playerId/:cursor/:start",
    strategy: "database",
    cacheTtlSeconds: 10 * 60,
    cacheTable: "GameRecord",
    note: "Player record ranges should query GameRecord and Player once ingestion is complete.",
  },
  {
    pattern: "view_game/:locale/:mode/:recordId",
    strategy: "external",
    cacheTtlSeconds: null,
    cacheTable: null,
    note: "Masked game viewer remains a pass-through external HTML/redirect endpoint, not a JSON cache candidate.",
  },
] as const satisfies readonly CachePolicy[];

export type ExternalApiEndpointPolicy =
  (typeof EXTERNAL_API_ENDPOINT_POLICIES)[number];

export function getExternalApiCacheTtl(
  pattern: ExternalApiEndpointPolicy["pattern"],
) {
  return (
    EXTERNAL_API_ENDPOINT_POLICIES.find((policy) => policy.pattern === pattern)
      ?.cacheTtlSeconds ?? null
  );
}

function normalizePath(path: string) {
  return path.replace(/^\/+/, "");
}

function getApiSuffix(host: string) {
  const contestMatch = /^([^.]+)\.contest\./i.exec(host);

  if (contestMatch) {
    return `api/contest/${contestMatch[1]}/`;
  }

  return DEFAULT_API_SUFFIX;
}

function isAllowedExternalPath(path: string) {
  const normalizedPath = normalizePath(path);

  if (normalizedPath.includes("..") || normalizedPath.includes("//")) {
    return false;
  }

  return EXTERNAL_API_ENDPOINT_POLICIES.some(({ pattern }) => {
    const prefix = pattern.split(":")[0];
    return (
      normalizedPath === prefix.replace(/\/$/, "") ||
      normalizedPath.startsWith(prefix)
    );
  });
}

function buildCacheKey(method: string, endpoint: string, requestBody = "") {
  const rawKey = `${method}:${endpoint}:${requestBody}`;
  let hash = 5381;

  for (let index = 0; index < rawKey.length; index += 1) {
    hash = (hash * 33) ^ rawKey.charCodeAt(index);
  }

  return `${method}:${endpoint.slice(0, 120)}:${(hash >>> 0).toString(36)}`;
}

function getCachePolicy(path: string, method: string) {
  if (method !== "GET" && method !== "POST") {
    return null;
  }

  const normalizedPath = normalizePath(path);
  const policy = EXTERNAL_API_ENDPOINT_POLICIES.find(({ pattern }) => {
    const prefix = pattern.split(":")[0];
    return (
      normalizedPath === prefix.replace(/\/$/, "") ||
      normalizedPath.startsWith(prefix)
    );
  });

  if (!policy?.cacheTtlSeconds || policy.pattern.startsWith("view_game")) {
    return null;
  }

  return policy;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeout = REQUEST_TIMEOUT_MS,
) {
  const abortController = new AbortController();
  const timeoutToken = setTimeout(() => abortController.abort(), timeout);

  try {
    return await fetch(url, { ...init, signal: abortController.signal });
  } finally {
    clearTimeout(timeoutToken);
  }
}

async function fetchFromMirror(path: string, init: RequestInit) {
  try {
    return await fetchWithTimeout(selectedMirror + path, init);
  } catch (error) {
    console.warn(`Failed to fetch external API from ${selectedMirror}`, error);

    if (mirrorProbePromise) {
      await mirrorProbePromise.catch(() => undefined);
      return fetchWithTimeout(selectedMirror + path, init);
    }
  }

  mirrorProbePromise = Promise.any(
    DATA_MIRRORS.map((mirror) =>
      fetchWithTimeout(mirror + path, init, PROBE_TIMEOUT_MS).then(
        (response) => {
          selectedMirror = mirror;
          return response;
        },
      ),
    ),
  );
  mirrorProbePromise.finally(() => {
    mirrorProbePromise = null;
  });

  return mirrorProbePromise;
}

async function readUsableCache(cacheKey: string) {
  const cached = await db.externalApiCache.findUnique({ where: { cacheKey } });

  if (!cached || cached.expiresAt <= new Date()) {
    return null;
  }

  return cached;
}

function responseFromCache(
  cached: NonNullable<Awaited<ReturnType<typeof readUsableCache>>>,
) {
  const headers = new Headers(
    (cached.responseHeaders as Record<string, string> | null) ?? {},
  );
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("transfer-encoding");
  headers.set("content-type", "application/json");
  headers.set("x-ppong-nya-cache", "hit");

  return new Response(JSON.stringify(cached.payload), {
    status: cached.status,
    headers,
  });
}

async function writeCache(params: {
  cacheKey: string;
  endpoint: string;
  method: string;
  requestBody?: string;
  response: Response;
  payload: unknown;
  ttlSeconds: number;
}) {
  const bodyLength = JSON.stringify(params.payload).length;

  if (bodyLength > MAX_CACHE_BODY_BYTES) {
    return;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + params.ttlSeconds * 1000);
  const responseHeaders = Object.fromEntries(params.response.headers.entries());

  await db.externalApiCache.upsert({
    where: { cacheKey: params.cacheKey },
    create: {
      cacheKey: params.cacheKey,
      endpoint: params.endpoint,
      method: params.method,
      requestBody: params.requestBody,
      status: params.response.status,
      responseHeaders,
      payload: params.payload as Prisma.InputJsonValue,
      expiresAt,
    },
    update: {
      status: params.response.status,
      responseHeaders,
      payload: params.payload as Prisma.InputJsonValue,
      expiresAt,
    },
  });
}

async function finalizeJsonResponse(params: {
  cacheKey: string | null;
  endpoint: string;
  method: string;
  requestBody?: string;
  response: Response;
  ttlSeconds?: number;
  apiSuffix: string;
}) {
  const payload = await params.response.json();

  if (payload?.result_key) {
    const resultPath = `${params.apiSuffix}result/${payload.result_key}`;
    const resultResponse = await fetchFromMirror(resultPath, {
      headers: { "Cache-Control": "max-age=0, no-cache" },
    });

    return finalizeJsonResponse({ ...params, response: resultResponse });
  }

  if (params.cacheKey && params.ttlSeconds && params.response.ok) {
    await writeCache({
      cacheKey: params.cacheKey,
      endpoint: params.endpoint,
      method: params.method,
      requestBody: params.requestBody,
      response: params.response,
      payload,
      ttlSeconds: params.ttlSeconds,
    }).catch((error) => {
      console.warn("Failed to write external API cache", error);
    });
  }

  const headers = new Headers(params.response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("transfer-encoding");
  headers.set("content-type", "application/json");
  headers.set("x-ppong-nya-cache", "miss");

  return new Response(JSON.stringify(payload), {
    status: params.response.status,
    statusText: params.response.statusText,
    headers,
  });
}

export async function fetchExternalApi(input: {
  host: string;
  path: string;
  method?: string;
  body?: string;
  headers?: HeadersInit;
}) {
  const method = input.method ?? "GET";
  const normalizedPath = normalizePath(input.path);

  if (!isAllowedExternalPath(normalizedPath)) {
    return new Response(
      JSON.stringify({ message: "Unsupported external API endpoint." }),
      {
        status: 404,
        headers: { "content-type": "application/json" },
      },
    );
  }

  const apiSuffix = getApiSuffix(input.host || DEFAULT_PUBLIC_HOST);
  const endpoint = `${apiSuffix}${normalizedPath}`;
  const cachePolicy = getCachePolicy(normalizedPath, method);
  const cacheKey = cachePolicy
    ? buildCacheKey(method, endpoint, input.body)
    : null;

  if (cacheKey) {
    const cached = await readUsableCache(cacheKey).catch((error) => {
      console.warn("Failed to read external API cache", error);
      return null;
    });

    if (cached) {
      return responseFromCache(cached);
    }
  }

  const response = await fetchFromMirror(endpoint, {
    method,
    body: input.body,
    headers: input.headers,
  });
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return finalizeJsonResponse({
      cacheKey,
      endpoint,
      method,
      requestBody: input.body,
      response,
      ttlSeconds: cachePolicy?.cacheTtlSeconds ?? undefined,
      apiSuffix,
    });
  }

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("transfer-encoding");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
