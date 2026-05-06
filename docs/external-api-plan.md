# 외부 API endpoint 인벤토리 및 마이그레이션 계획

이 문서는 `src/data/source/api.ts`, `src/data/source/misc.ts`,
`src/data/source/records/loader.ts`에서 현재 사용하는 모든 upstream ppong-nya
데이터 endpoint를 정리하고, 신규 ppong-nya에서 각 endpoint를 외부 API로 계속
프록시할지 또는 자체 DB query로 대체할지 기록합니다.

## 상위 host 및 proxy 경계

브라우저는 `https://data.ppong-nya.com/` 또는 해당 mirror를 직접 호출하면 안 됩니다.
클라이언트 데이터 helper는 반드시 내부 SvelteKit route인 `/api/external/*`를 호출해야
하며, 이 route가 `src/lib/server/services/externalApi.ts`에 위임해 외부 API와 통신합니다.
이 정책은 외부 API 접근을 서버 경계 안에 고정해 endpoint allow-list, 기존 mirror 목록,
`resultKey` 후속 요청, DB 기반 JSON 응답 캐시를 한곳에서 통제하기 위한 것입니다.
즉, 신규 코드에서 외부 API가 필요하더라도 클라이언트가 upstream URL을 직접 `fetch`하지
말고 내부 `/api/external/*`를 거쳐야 합니다.

## Endpoint 인벤토리

| Endpoint 패턴 | 현재 출처 | 신규 ppong-nya 결정 | 캐시 여부 | 대상 테이블 |
| --- | --- | --- | --- | --- |
| `search_player/:prefix?limit=&tag=all` | `misc.ts` | 초기에는 외부 API 유지 | 예, 1시간 | `ExternalApiCache` |
| `player_extended_stats/:playerId[/start/end]?mode=` | `misc.ts`, `loader.ts` | 로컬에서 계산한 snapshot으로 대체 | 프록시 중에는 예, 1시간 | `PlayerSnapshot` + `ExternalApiCache` |
| `player_delta_ranking/:timespan` | `misc.ts` | 외부 API 유지 | 예, 30분 | `StatisticsSnapshot` + `ExternalApiCache` |
| `career_ranking/:type[_minGames]?mode=` | `misc.ts` | ranking backfill이 준비될 때까지 외부 API 유지 | 예, 1시간 | `StatisticsSnapshot` + `ExternalApiCache` |
| `global_statistics_2?mode=` | `misc.ts` | 외부 API 유지 | 예, 1시간 | `StatisticsSnapshot` + `ExternalApiCache` |
| `global_statistics_year?mode=` | `misc.ts` | 외부 API 유지 | 예, 6시간 | `StatisticsSnapshot` + `ExternalApiCache` |
| `global_statistics_snapshot/:yyyy-mm-dd?mode=` | `misc.ts` | 외부 API 유지 | 예, 24시간 | `StatisticsSnapshot` + `ExternalApiCache` |
| `level_statistics` | `misc.ts` | 외부 API 유지 | 예, 6시간 | `StatisticsSnapshot` + `ExternalApiCache` |
| `global_histogram` | `misc.ts` | 외부 API 유지 | 예, 6시간 | `StatisticsSnapshot` + `ExternalApiCache` |
| `fan_stats` | `misc.ts` | 외부 API 유지 | 예, 6시간 | `StatisticsSnapshot` + `ExternalApiCache` |
| `rank_rate_by_seat` | `misc.ts` | 외부 API 유지 | 예, 6시간 | `StatisticsSnapshot` + `ExternalApiCache` |
| `recent_highlight_games?limit=&mode=` | `records/loader.ts` | ingestion 이후 `GameRecord` highlight query로 대체 | 프록시 중에는 예, 10분 | `GameRecord` + `ExternalApiCache` |
| `games_by_id/:ids` | `records/loader.ts` | external ID/UUID 기반 `GameRecord` lookup으로 대체 | 프록시 중에는 예, 24시간 | `GameRecord` + `ExternalApiCache` |
| `games/:cursor/:start?limit=&descending=&mode=` | `records/loader.ts` | `GameRecord` range query로 대체 | 프록시 중에는 예, 5분 | `GameRecord` + `ExternalApiCache` |
| `player_stats/:playerId[/start/end]?mode=&tag=` | `records/loader.ts` | 로컬에서 계산한 player snapshot으로 대체 | 프록시 중에는 예, 1시간 | `PlayerSnapshot` + `ExternalApiCache` |
| `player_records/:playerId/:cursor/:start?limit=&mode=&descending=&tag=` | `records/loader.ts` | `GameRecord`와 `Player` join으로 대체 | 프록시 중에는 예, 10분 | `GameRecord` + `ExternalApiCache` |
| `view_game/:locale/:mode/:recordId[/encodedAccountId]` | `record.ts` via `getApiPrefix()` | masked viewer link를 위해 외부 pass-through 유지 | JSON 캐시 없음 | 없음 |
| `result/:resultKey` | `api.ts` response handler | 내부 service 후속 요청 전용이며 client endpoint로 노출하지 않음 | 직접 client 캐시 없음 | 없음 |

## 캐시 및 저장소 결정

- `ExternalApiCache`는 method, endpoint, request body, response header, HTTP status,
  payload, expiration을 기준으로 프록시된 raw JSON을 저장합니다. 아직 upstream을 호출하는
  모든 JSON endpoint의 마이그레이션 안전장치입니다.
- `GameRecord`는 import되었거나 사용자가 소유한 record의 canonical table로 유지되며,
  무손실 ingestion을 위해 선택적 upstream identifier(`source`, `sourceRecordId`, `uuid`,
  `externalModeId`)와 `rawPayload`를 포함합니다.
- `PlayerSnapshot`은 player, scope, mode set, period별로 구체화된 player summary와
  extended statistics를 저장합니다. 마이그레이션 중에는 local record 또는 캐시된 upstream
  payload에서 채울 수 있습니다.
- `StatisticsSnapshot`은 cache key, scope, mode, period별 aggregate/ranking/statistics
  payload를 저장합니다. 이를 통해 global page는 client code를 바꾸지 않고 proxy cache에서
  자체 scheduled materialization으로 이동할 수 있습니다.
