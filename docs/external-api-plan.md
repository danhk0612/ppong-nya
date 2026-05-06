# External API endpoint inventory and migration plan

This document inventories every upstream ppong-nya data endpoint currently used by
`src/data/source/api.ts`, `src/data/source/misc.ts`, and
`src/data/source/records/loader.ts`, and records whether the new ppong-nya should
continue proxying it from the external API or replace it with first-party DB
queries.

## Upstream host and proxy boundary

The browser must not call `https://data.ppong-nya.com/` or its mirrors directly.
Client data helpers call the internal `/api/external/*` SvelteKit route, and that
route delegates to `src/lib/server/services/externalApi.ts`. The service keeps
the legacy mirror list server-side and applies endpoint allow-listing, result-key
follow-up requests, and DB-backed JSON response caching.

## Endpoint inventory

| Endpoint pattern | Current source | New ppong-nya decision | Cache? | Target table |
| --- | --- | --- | --- | --- |
| `search_player/:prefix?limit=&tag=all` | `misc.ts` | Continue external API initially | Yes, 1 hour | `ExternalApiCache` |
| `player_extended_stats/:playerId[/start/end]?mode=` | `misc.ts`, `loader.ts` | Replace with locally computed snapshots | Yes while proxied, 1 hour | `PlayerSnapshot` + `ExternalApiCache` |
| `player_delta_ranking/:timespan` | `misc.ts` | Continue external API | Yes, 30 minutes | `StatisticsSnapshot` + `ExternalApiCache` |
| `career_ranking/:type[_minGames]?mode=` | `misc.ts` | Continue external API until ranking backfill exists | Yes, 1 hour | `StatisticsSnapshot` + `ExternalApiCache` |
| `global_statistics_2?mode=` | `misc.ts` | Continue external API | Yes, 1 hour | `StatisticsSnapshot` + `ExternalApiCache` |
| `global_statistics_year?mode=` | `misc.ts` | Continue external API | Yes, 6 hours | `StatisticsSnapshot` + `ExternalApiCache` |
| `global_statistics_snapshot/:yyyy-mm-dd?mode=` | `misc.ts` | Continue external API | Yes, 24 hours | `StatisticsSnapshot` + `ExternalApiCache` |
| `level_statistics` | `misc.ts` | Continue external API | Yes, 6 hours | `StatisticsSnapshot` + `ExternalApiCache` |
| `global_histogram` | `misc.ts` | Continue external API | Yes, 6 hours | `StatisticsSnapshot` + `ExternalApiCache` |
| `fan_stats` | `misc.ts` | Continue external API | Yes, 6 hours | `StatisticsSnapshot` + `ExternalApiCache` |
| `rank_rate_by_seat` | `misc.ts` | Continue external API | Yes, 6 hours | `StatisticsSnapshot` + `ExternalApiCache` |
| `recent_highlight_games?limit=&mode=` | `records/loader.ts` | Replace with `GameRecord` highlight queries after ingestion | Yes while proxied, 10 minutes | `GameRecord` + `ExternalApiCache` |
| `games_by_id/:ids` | `records/loader.ts` | Replace with `GameRecord` lookups by external ID/UUID | Yes while proxied, 24 hours | `GameRecord` + `ExternalApiCache` |
| `games/:cursor/:start?limit=&descending=&mode=` | `records/loader.ts` | Replace with `GameRecord` range queries | Yes while proxied, 5 minutes | `GameRecord` + `ExternalApiCache` |
| `player_stats/:playerId[/start/end]?mode=&tag=` | `records/loader.ts` | Replace with locally computed player snapshots | Yes while proxied, 1 hour | `PlayerSnapshot` + `ExternalApiCache` |
| `player_records/:playerId/:cursor/:start?limit=&mode=&descending=&tag=` | `records/loader.ts` | Replace with joins over `GameRecord` and `Player` | Yes while proxied, 10 minutes | `GameRecord` + `ExternalApiCache` |
| `view_game/:locale/:mode/:recordId[/encodedAccountId]` | `record.ts` via `getApiPrefix()` | Continue external pass-through for masked viewer links | No JSON cache | None |
| `result/:resultKey` | `api.ts` response handler | Internal service follow-up only; not exposed as a client endpoint | No direct client cache | None |

## Cache and storage decisions

- `ExternalApiCache` stores raw proxied JSON by method, endpoint, request body,
  response headers, HTTP status, payload, and expiration. It is the migration
  safety net for every JSON endpoint that still hits upstream.
- `GameRecord` remains the canonical table for imported or user-owned records and
  now includes optional upstream identifiers (`source`, `sourceRecordId`, `uuid`,
  `externalModeId`) plus `rawPayload` for lossless ingestion.
- `PlayerSnapshot` stores materialized player summaries and extended statistics
  by player, scope, mode set, and period. It can be populated either from local
  records or from cached upstream payloads during migration.
- `StatisticsSnapshot` stores aggregate/ranking/statistics payloads by cache key,
  scope, modes, and period so global pages can move from proxy cache to first-
  party scheduled materialization without changing client code.
