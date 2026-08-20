/* eslint-disable @typescript-eslint/no-empty-function */
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

let onMaintenance: (msg: string) => void = () => {};

export function setMaintenanceHandler(handler: (msg: string) => void) {
  onMaintenance = handler;
}

export const getApiPrefix = () => "/api/external/";

const CAP_API_ENDPOINT = "/api/cap/";

type CapSolver = {
  solve(): Promise<{ token: string }>;
};

let capSolver: CapSolver | null = null;
let capToken = "";
let capRefreshPromise: Promise<string> | null = null;

async function refreshCapToken() {
  if (capRefreshPromise) {
    return capRefreshPromise;
  }

  capRefreshPromise = (async () => {
    capToken = "";

    if (!capSolver) {
      const { default: capWasmUrl } =
        await import("@cap.js/wasm/browser/cap_wasm_bg.wasm?url");
      Object.assign(globalThis, { CAP_CUSTOM_WASM_URL: capWasmUrl });
      const { default: Cap } = await import("cap-widget");
      capSolver = new Cap({ apiEndpoint: CAP_API_ENDPOINT }) as CapSolver;
    }

    const result = await capSolver.solve();
    capToken = result.token;
    return capToken;
  })();

  try {
    return await capRefreshPromise;
  } finally {
    capRefreshPromise = null;
  }
}

async function fetchData(
  path: string,
  opts: Parameters<typeof fetch>[1] = {},
  allowCapRefresh = true,
): Promise<Response> {
  const normalizedPath = path.replace(/^\/+/, "");
  const headers = new Headers(opts.headers);

  if (capToken) {
    headers.set("authorization", `Bearer ${capToken}`);
  }

  const response = await fetch(`${getApiPrefix()}${normalizedPath}`, {
    ...opts,
    headers,
  });

  if (
    allowCapRefresh &&
    response.status === 429 &&
    (await response.clone().text()).includes("x-cap-token-required")
  ) {
    await refreshCapToken();
    headers.set("cache-control", "no-cache");
    return fetchData(path, { ...opts, headers }, false);
  }

  return response;
}

let apiCache = {} as { [path: string]: unknown };

export type ApiError = Error & {
  status: number;
  statusText: string;
  url: string;
};

export type WithLastModified = {
  readonly _lastModified?: dayjs.Dayjs;
};

async function handleResponse<T>(
  cacheKey: string,
  resp: Response,
): Promise<T & WithLastModified> {
  if (!resp.ok) {
    const error = new Error("Failed API call");
    Object.assign(error, {
      response: resp,
      status: resp.status,
      statusText: resp.statusText,
      headers: resp.headers,
      url: resp.url,
      json:
        resp.json?.bind(resp) ||
        (async () => {
          throw resp;
        }),
    });
    throw error;
  }
  let data = await resp.json();
  if (data?.maintenance) {
    onMaintenance(data.maintenance);
    return new Promise(() => {}) as Promise<T & WithLastModified>; // Freeze all other components
  }
  const lastModified = resp.headers.get("last-modified");
  if (lastModified && typeof data === "object") {
    const parsed = dayjs.utc(
      lastModified.slice(lastModified.indexOf(" ") + 1),
      "DD MMM YYYY HH:mm:ss",
    );
    if (parsed.isValid()) {
      data = Object.defineProperty(data, "_lastModified", {
        value: parsed,
        writable: false,
      });
    }
  }
  if (Object.keys(apiCache).length > 500) {
    apiCache = {};
  }
  apiCache[cacheKey] = data;
  return data as T & WithLastModified;
}

export async function apiGet<T>(
  path: string,
): Promise<T & { _lastModified?: dayjs.ConfigType }> {
  if (path in apiCache) {
    return apiCache[path] as T & WithLastModified;
  }
  const resp = await fetchData(path);
  return await handleResponse(path, resp);
}

export async function apiCacheablePost<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const bodyStr = JSON.stringify(body);
  const key = `${path}|${bodyStr}`;
  if (key in apiCache) {
    return apiCache[key] as T;
  }
  const resp = await fetchData(path, {
    method: "POST",
    body: bodyStr,
    headers: {
      "Content-Type": "application/json",
    },
  });
  return await handleResponse(key, resp);
}
