# Public Player Cache Migration Plan

## Goal

Simplify 퐁냐 into a public player lookup and statistics service without user accounts or favorites.

A player search or direct player page visit should reuse data already stored by the service, incrementally fetch missing or stale records from the upstream API, and calculate statistics for the requested date range and table type.

## Target behavior

1. Remove the membership/login/account model and user-owned favorites.
2. Store searched player identities and fetched game records as shared server data.
3. Replace the fixed recent-30-games view with date-range queries.
4. Reuse locally stored data first and fetch only missing/new data when possible.
5. Automatically refresh stale player data when a player page is opened while keeping a manual refresh action.
6. Add a table-type filter and recalculate statistics for the selected table type and date range.
7. Accept both numeric player IDs and player names for direct player navigation.
8. Preserve the existing CAP proxy and external API response/compression fixes.
9. Continue to support 4-player Mahjong Soul records only.

## Data model direction

### CachedPlayer

Shared player identity/cache metadata keyed by Mahjong Soul player ID.

Planned fields:

- `playerId`
- `nickname`
- `level`
- `maxLevel`
- `latestTimestamp`
- `lastAccessedAt`
- `lastUpdatedAt`
- timestamps

### CachedPlayerGameRecord

Many-to-many link between a cached player and an existing shared `GameRecord` row.

A game UUID is stored only once in `GameRecord`; every participating/queried player can reference the same row.

### PlayerQueryCoverage

Tracks which date range/table modes are known to have been fetched for a player so subsequent requests can determine whether upstream backfill is required instead of downloading the same range repeatedly.

### PlayerStatisticsCache

Caches statistics by player, date range and table mode. Cache keys must include all query dimensions.

## Data retention

Initial policy target:

- inactive-player retention: 90 days
- maximum retained records per player: 2,000

These limits should be configurable rather than hard-coded. Cleanup must not remove a shared `GameRecord` while another cached player still references it.

## Refresh policy

- Serve usable local data first.
- Consider player summary/statistics stale after the configured player-stat TTL.
- Consider the newest record range stale after the configured record TTL.
- On player-page access, refresh automatically when stale.
- Keep a manual refresh action that bypasses freshness checks.
- Merge newly fetched records by source UUID and never create duplicates.

## Date-range and table filters

Default UI:

- recent 30 days
- all supported 4-player tables

Preset periods:

- 7 days
- 30 days
- 90 days
- 6 months
- 1 year
- custom start/end dates

Supported 4-player modes remain the current six Mahjong Soul mode IDs used by the project.

The selected range and mode should be represented in URL query parameters so refresh/share preserves the view.

## Statistics

Statistics must be calculated from the selected date range and selected mode(s), not from a fixed last-30-games collection.

Reuse the existing upstream player-stat endpoints and existing filtered-record/statistics flow where possible. The current record loader already supports range pagination and statistics derived from selected record keys.

## Player routing

`/player/[key]` should accept:

- numeric ID: load directly
- nickname: resolve local cached players first, then upstream player search

If exactly one current exact-name match exists, redirect to the canonical numeric-ID URL. If multiple viable exact-name matches exist, show a selection instead of guessing.

## Migration order

### Stage 1 — Shared cache schema

- Add `CachedPlayer`.
- Add shared player/game relationship.
- Add range coverage and filtered-stat cache models.
- Keep existing user/favorite tables temporarily so production data can be migrated safely.

### Stage 2 — Public player data service

- DB-first player lookup.
- Incremental upstream fetch.
- Range coverage tracking.
- stale detection and forced refresh.
- merge/deduplicate game records.

### Stage 3 — Range and table filtering

- remove 30-game server/client limits.
- query records by date range and mode.
- backfill missing requested ranges.
- filtered statistics and extended statistics.

### Stage 4 — Player page/UI

- date presets and custom dates.
- table dropdown.
- last-updated display.
- automatic stale refresh.
- manual refresh button.
- URL query-state persistence.

### Stage 5 — Name routing/search simplification

- direct nickname routes.
- local-first name resolution.
- upstream fallback.
- duplicate-name chooser.
- remove favorite actions from search UI.

### Stage 6 — Membership/favorites removal

- migrate useful existing favorite/player-record data into the shared cache.
- remove login/account/auth/session UI and APIs.
- remove favorite APIs and user-specific synchronization.
- remove obsolete authentication dependencies/configuration.
- remove obsolete user-owned database tables only after migration is verified.

### Stage 7 — Retention and cleanup

- inactive player cleanup.
- per-player record cap.
- orphan shared-record cleanup.
- expired query/statistics cache cleanup.

### Stage 8 — Verification/deployment

Verify at minimum:

- direct numeric ID access
- direct Korean/English nickname access
- duplicate nickname handling
- first search/fetch
- cached repeat access
- automatic stale refresh
- forced manual refresh
- ranges exceeding 100 games
- date boundary correctness
- each table filter
- statistics changing with date/table filters
- mobile layout
- MariaDB migration
- CAP proxy regression
- external API proxy/compression regression

## Current implementation notes

The current implementation stores synchronized data only for favorites, limits stored links and incoming records to 30, and keys player snapshots by user. Existing `PlayerDataLoader` already supports date ranges and paginated chunks, and `FilteredPlayerDataLoader` can calculate statistics from selected record keys/modes. Those existing mechanisms should be reused rather than duplicated.
