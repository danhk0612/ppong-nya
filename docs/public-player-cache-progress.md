# Public Player Cache Migration Progress

This file tracks implementation against `docs/public-player-cache-plan.md`.

## Status

- [x] Plan documented
- [x] Feature branch created: `feature/public-player-cache`
- [x] Stage 1 SQL migration added for shared player cache tables
- [x] Stage 1 Prisma schema updated
- [x] Stage 1 schema/data-model build verification
- [x] Stage 2 public player data service
- [x] Stage 3 range and table filtering
- [x] Stage 4 player page/UI
- [x] Stage 5 name routing/search simplification
- [x] Stage 6 membership/favorites runtime removal and data migration
- [x] Stage 7 retention and cleanup
- [ ] Stage 8 production verification/deployment

## Stage 1 notes

Existing membership/favorite tables remain intentionally untouched during the first schema stage. This allows current production data to stay readable while the public cache path is built and verified. Removal happens only after the migration path is proven.

The shared schema includes `CachedPlayer`, `CachedPlayerGameRecord`, `PlayerQueryCoverage`, and `PlayerStatisticsCache`, with a back-reference from `GameRecord`.

## Stage 2 notes

The public player cache service provides:

- DB-first player lookup
- shared player identity storage
- 100-record upstream pagination
- UUID-based shared game-record upsert/deduplication
- player/game relationship storage
- fetched range coverage tracking
- stale detection based on the existing player-record TTL
- incremental refresh from the newest locally stored record when a previously covered range becomes stale
- forced refresh support
- unauthenticated `/api/players/[id]` GET/POST endpoints

`GET` uses local data and automatically refreshes missing, uncovered, or stale data. `POST` forces a refresh for manual update actions.

## Stage 3 notes

The public API accepts `from`, `to`, and `mode` query parameters and no longer imposes a recent-30-record limit on the new public data path.

Filtered statistics reuse the existing upstream POST behavior by sending the selected locally stored game start-time keys and mode IDs to `player_stats/:playerId` and `player_extended_stats/:playerId`. Results are cached in `PlayerStatisticsCache` using player/range/mode dimensions.

## Stage 4 notes

The player page now uses the public player API instead of favorite synchronization and provides:

- default recent-30-days range
- 7/30/90-day, 6-month, and 1-year presets
- custom start/end dates
- table-type dropdown
- URL query persistence for range/mode
- statistics recalculated for the selected conditions
- selected-range game list
- last update display
- automatic stale refresh on page load
- manual refresh button
- removal of favorite controls from the player page

## Stage 5 notes

Player navigation and search support both nickname and numeric ID:

- numeric `/player/[id]` access stays canonical
- nickname routes resolve exact local cached matches first
- unresolved names fall back to the existing upstream player search
- one exact match redirects to the canonical numeric player URL
- multiple exact matches redirect to the search result chooser instead of guessing
- `PlayerSearch` accepts nickname or numeric ID and no longer contains login/favorite actions
- the players search page no longer depends on session data

## Stage 6 notes

The service no longer exposes or executes membership/favorite functionality at runtime:

- authentication hooks and Auth.js configuration removed
- login/account/auth/favorite routes and APIs removed
- account/favorite navigation and homepage sections removed
- client favorite synchronization and server auth/session/password helpers removed
- auth/OAuth/default-admin environment requirements removed from application and Compose examples
- legacy `/records` redirects to the removed account page deleted
- migration `20260831032000_migrate_favorites_to_public_cache` copies existing favorite players and their linked game records into the shared cache before legacy data is retired

Legacy membership/favorite database models and tables remain until production migration verifies that copied public-cache data is complete. Physical table removal can then be done safely without losing the rollback path.

## Stage 7 notes

Shared-cache retention is enforced by lightweight maintenance triggered by player API access and throttled to at most once per application process per hour.

Default policy:

- players not accessed for 90 days are removed from the shared cache
- each cached player retains at most 2,000 linked game records
- expired player-statistics caches are removed
- expired external API caches are removed
- stale query-coverage markers older than the retention window are removed
- external `GameRecord` rows that are no longer referenced by public-cache links, legacy favorite links, or a legacy owner are removed

`PLAYER_CACHE_RETENTION_DAYS` and `PLAYER_CACHE_MAX_RECORDS` can override the defaults in Docker/production configuration.

## Stage 8 notes

CI now starts a real MariaDB 11.4 service and applies the complete Prisma migration history before type checking and building the application. This exposed and allowed fixing two MariaDB-specific migration issues before production:

1. public-cache index/constraint identifiers exceeded MariaDB's identifier length limit
2. the legacy favorite tables use camelCase column names while the new public-cache tables use snake_case mappings

After those fixes, the complete migration history successfully applies to a clean MariaDB 11.4 instance. Prisma generation, Svelte/TypeScript checks, application build, root-route verification, and Compose validation also pass.

Remaining Stage 8 work is production deployment and runtime verification against the existing production MariaDB data and external API/CAP proxy path. Legacy membership/favorite tables should only be physically dropped after that production data migration is verified.
