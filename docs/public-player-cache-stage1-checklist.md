# Public Player Cache Migration Checklist

Stage 1 through Stage 7 implementation is complete. Current verification status is tracked in `docs/public-player-cache-progress.md`.

Remaining production checklist:

- [ ] Merge the verified implementation into `master`
- [ ] Confirm `ghcr.io/danhk0612/ppong-nya:latest` ARM64 image publication
- [ ] Back up the production MariaDB data directory/database before migration
- [ ] Pull the latest repository and image on Oracle Cloud
- [ ] Run Compose and confirm `migrate` exits successfully
- [ ] Confirm existing favorite player/game data appears in the shared cache
- [ ] Verify nickname and numeric-ID player access
- [ ] Verify date range and table filters change records/statistics correctly
- [ ] Verify automatic stale refresh and manual refresh
- [ ] Verify CAP proxy and external API response/compression behavior
- [ ] After production data validation, remove legacy membership/favorite tables and unused auth dependencies in a follow-up cleanup
