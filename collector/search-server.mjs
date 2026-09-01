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

async function fetchPlayerById(client, accountId) {
  const result = await client.searchAccountById(Number(accountId));
  if (result?.error?.code) {
    console.warn(`[collector] native searchAccountById account=${accountId} error=${result.error.code}`);
  }
  return normalizePlayer(result?.player);
}

async function searchPlayers(client, query, limit) {
  const matched = await client.searchAccountByPattern(query);
  if (matched?.error?.code) {
    console.warn(`[collector] native searchAccountByPattern query=${JSON.stringify(query)} error=${matched.error.code}`);
  }

  const accountIds = [];
  const addId = (value) => {
    const id = Number(value || 0);
    if (Number.isInteger(id) && id > 0 && !accountIds.includes(id)) accountIds.push(id);
  };

  // For an exact public-id match, Mahjong Soul returns the decoded internal
  // account id in decode_id. Pattern matches are already internal account ids.
  addId(matched?.decode_id);
  if (Array.isArray(matched?.match_accounts)) {
    for (const value of matched.match_accounts) {
      addId(value);
      if (accountIds.length >= limit) break;
    }
  }

  if (!accountIds.length) {
    console.log(`[collector] native search query=${JSON.stringify(query)} decoded=0 results=0`);
    return [];
  }

  const players = [];
  for (const accountId of accountIds.slice(0, limit)) {
    const player = await fetchPlayerById(client, accountId);
    if (player) players.push(player);
  }

  console.log(
    `[collector] native search query=${JSON.stringify(query)} decoded=${accountIds.length} results=${players.length}`,
  );
  return players;
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
