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
- [ ] Stage 5 name routing/search simplification
- [ ] Stage 6 membership/favorites removal
- [ ] Stage 7 retention and cleanup
- [ ] Stage 8 verification/deployment

## Stage 1 notes

Existing membership/favorite tables remain intentionally untouched during the first schema stage. This allows current production data to stay readable while the public cache path is built and verified. Removal happens only after the migration path is proven.

The shared schema includes `CachedPlayer`, `CachedPlayerGameRecord`, `PlayerQueryCoverage`, and `PlayerStatisticsCache`, with a back-reference from `GameRecord`.

GitHub Actions verifies Prisma client generation, Svelte/TypeScript checks, application build, and Compose configuration. Applying the migration against the production MariaDB and validating migrated runtime data remains part of Stage 8.

## Stage 2 notes

The public player cache service now provides:

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

The latest Stage 4 commit passed GitHub Actions Prisma generation, Svelte/TypeScript checks, application build, and Compose validation. External API behavior and production MariaDB migration are intentionally deferred to Stage 8 runtime verification.
