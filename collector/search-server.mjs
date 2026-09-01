import http from "node:http";

const DEFAULT_PORT = 3001;
const MAX_RESULTS = 20;

function levelView(level) {
  if (!level || typeof level !== "object") return null;
  return {
    id: Number(level.id || 0),
    score: Number(level.score || 0),
  };
}

function normalizePlayer(player) {
  if (!player || !player.account_id || !player.nickname) return null;
  return {
    accountId: Number(player.account_id),
    nickname: String(player.nickname),
    level: levelView(player.level),
    level3: levelView(player.level3),
  };
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function errorCode(result) {
  return Number(result?.error?.code || 0);
}

async function fetchPlayerById(client, accountId) {
  const searchResult = await client.searchAccountById(Number(accountId));
  const searchPlayer = normalizePlayer(searchResult?.player);
  console.log(
    `[collector] native rpc searchAccountById account=${accountId} error=${errorCode(searchResult)} player=${searchPlayer ? 1 : 0}`,
  );
  if (searchPlayer) return searchPlayer;

  const infoResult = await client.fetchAccountInfo(Number(accountId));
  const infoPlayer = normalizePlayer(infoResult?.account);
  console.log(
    `[collector] native rpc fetchAccountInfo account=${accountId} error=${errorCode(infoResult)} account=${infoPlayer ? 1 : 0}`,
  );
  return infoPlayer;
}

async function searchNumericPlayer(client, query) {
  const numericId = Number(query);

  // Some clients expose an account_id directly while user-facing IDs may be EIDs.
  // Probe the direct account lookup first, then resolve EID if needed. The logs only
  // expose RPC status and presence flags, never private account fields.
  const directPlayer = await fetchPlayerById(client, numericId);
  if (directPlayer) {
    console.log(`[collector] native numeric search query=${query} route=direct-account results=1`);
    return [directPlayer];
  }

  const eidResult = await client.searchAccountByEid(numericId);
  const resolvedId = Number(eidResult?.account_id || 0);
  console.log(
    `[collector] native rpc searchAccountByEid eid=${query} error=${errorCode(eidResult)} resolved=${resolvedId > 0 ? 1 : 0}`,
  );
  if (!Number.isInteger(resolvedId) || resolvedId <= 0) {
    console.log(`[collector] native numeric search query=${query} route=eid results=0`);
    return [];
  }

  const resolvedPlayer = await fetchPlayerById(client, resolvedId);
  console.log(`[collector] native numeric search query=${query} route=eid results=${resolvedPlayer ? 1 : 0}`);
  return resolvedPlayer ? [resolvedPlayer] : [];
}

async function searchPlayers(client, query, limit) {
  if (/^\d+$/.test(query)) {
    return searchNumericPlayer(client, query);
  }

  const matched = await client.searchAccountByPattern(query);
  console.log(
    `[collector] native rpc searchAccountByPattern query=${JSON.stringify(query)} error=${errorCode(matched)} matches=${Array.isArray(matched?.match_accounts) ? matched.match_accounts.length : 0}`,
  );

  const accountIds = [];
  if (Array.isArray(matched?.match_accounts)) {
    for (const value of matched.match_accounts) {
      const id = Number(value || 0);
      if (Number.isInteger(id) && id > 0 && !accountIds.includes(id)) accountIds.push(id);
      if (accountIds.length >= limit) break;
    }
  }

  const players = [];
  for (const accountId of accountIds) {
    const player = await fetchPlayerById(client, accountId);
    if (player) players.push(player);
  }

  console.log(
    `[collector] native search query=${JSON.stringify(query)} resolved=${accountIds.length} results=${players.length}`,
  );
  return players.slice(0, limit);
}

export function startNativeSearchServer(client) {
  const port = Math.max(1, Math.min(65535, Number(process.env.NATIVE_SEARCH_PORT || DEFAULT_PORT)));

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://collector.internal");
      if (request.method !== "GET" || url.pathname !== "/search") {
        sendJson(response, 404, { message: "not found" });
        return;
      }

      const query = url.searchParams.get("q")?.trim() || "";
      if (!query) {
        sendJson(response, 200, []);
        return;
      }

      const requestedLimit = Number(url.searchParams.get("limit") || MAX_RESULTS);
      const limit = Math.max(1, Math.min(MAX_RESULTS, Number.isFinite(requestedLimit) ? requestedLimit : MAX_RESULTS));
      const players = await searchPlayers(client, query, limit);
      sendJson(response, 200, players);
    } catch (error) {
      console.warn(`[collector] native search failed: ${String(error?.message || error)}`);
      sendJson(response, 502, { message: "Mahjong Soul player search failed" });
    }
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[collector] native search listening on ${port}`);
  });
  return server;
}
