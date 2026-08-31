# Native Mahjong Soul collector

## Goal

퐁냐의 최종 데이터 경로를 amae-koromo HTTP API 의존 방식에서 작혼 서버로부터 직접 수집하는 방식으로 전환한다.

목표 데이터 흐름:

1. 작혼 클라이언트 리소스에서 최신 버전, gateway, protobuf 정의를 확인한다.
2. 전용 수집 계정으로 작혼 WebSocket gateway에 로그인한다.
3. `Lobby.fetchGameLiveList`로 4인 랭크전 진행 대국 UUID를 발견한다.
4. UUID를 MariaDB 수집 큐에 저장한다.
5. 대국 종료 후 `Lobby.fetchGameRecord`로 헤더와 protobuf 패보 원문을 확보한다.
6. 수집 원문을 `GameRecord`, `Player`, `CachedPlayer` 구조로 변환한다.
7. 통계 계산을 로컬 DB 기준으로 전환한다.
8. 전환 완료 후 amae-koromo API fallback을 제거한다.

## Reference implementation

조사 기준:

- `SAPikachu/amae-koromo`: 공개 프런트엔드/API 소비 코드
- `SAPikachu/amae-koromo-scripts`: 공개 수집/처리 스크립트. 저장소의 실제 `LICENSE` 파일은 MIT License이다.

퐁냐 collector는 위 저장소의 작동 원리와 공개 RPC 흐름을 참고해 현재 프로젝트 구조에 맞게 별도로 구현한다. 원본 수집 스택의 CouchDB, Redis, Google Cloud Storage 등은 도입하지 않는다.

## Four-player ranked modes

작혼 `mode_id`와 관전 `filter_id`의 현재 매핑:

| 탁 | 동풍전 | 남풍전 |
| --- | ---: | ---: |
| 동탁 | mode 2 / filter 202 | mode 3 / filter 203 |
| 은탁 | mode 5 / filter 205 | mode 6 / filter 206 |
| 금탁 | mode 8 / filter 208 | mode 9 / filter 209 |
| 옥탁 | mode 11 / filter 211 | mode 12 / filter 212 |
| 왕좌탁 | mode 15 / filter 215 | mode 16 / filter 216 |

`collector/modes.mjs`를 단일 정의 지점으로 사용한다.

## Storage

`collector_games`는 수집기의 영속 큐다.

- `DISCOVERED`: 관전 목록에서 UUID 발견
- `FETCHING`: 패보 조회 중
- `RETRY`: 아직 종료되지 않았거나 일시 오류
- `COLLECTED`: 헤더와 패보 원문 저장 완료
- `IGNORED`: 지원하지 않는 mode로 확인됨

패보 원문은 `record_data` LONGBLOB에 저장한다. 이를 통해 외부 API가 없어도 이후 통계 파서를 다시 실행할 수 있다.

`collector_state`에는 heartbeat와 마지막 상태를 저장한다.

## Deployment safety

초기 단계에서는 production Compose의 `collector` profile로 비활성 상태를 유지한다.

수집 계정 토큰은 실제 서버의 `.env`에만 둔다.

```env
MAJSOUL_ACCESS_TOKEN=...
MAJSOUL_OAUTH_TYPE=7
MAJSOUL_URL_BASE=https://mahjongsoul.game.yo-star.com/
MAJSOUL_LOGIN_REGION=en
COLLECTOR_LIST_ONLY=true
```

하위 탁 관전 목록 스파이크:

```bash
docker compose --profile collector --env-file .env \
  -f compose.production.yml -f compose.oracle.yml \
  run --rm -e COLLECTOR_LIST_ONLY=true -e COLLECTOR_ONE_SHOT=true collector
```

성공 기준:

- WebSocket 로그인 성공
- filter 202/203/205/206 요청 자체가 오류 없이 처리됨
- 실제 진행 중인 동탁/은탁 대국이 있는 시점에 `live games`가 1건 이상 반환됨
- UUID가 `collector_games`에 저장됨

패보 수집 스파이크에서는 `COLLECTOR_LIST_ONLY=false`로 실행하고 종료된 UUID가 `COLLECTED`가 되는지 확인한다.

## Migration stages

### Stage A — collector bootstrap

- [x] 4인 랭크전 mode/filter 정의
- [x] 동적 작혼 protobuf/gateway 로딩
- [x] WebSocket RPC 클라이언트
- [x] 수집 큐/원문 저장 migration
- [x] optional Compose collector service
- [x] collector container build
- [ ] 실제 작혼 계정으로 동탁/은탁 live-list 검증
- [ ] 실제 UUID 한 건의 `fetchGameRecord` 검증

### Stage B — local record ingestion

- [ ] `head`를 기존 `GameRecord`/`Player`로 변환
- [ ] player/account ID 및 닉네임 캐시 갱신
- [ ] 수집 패보의 중복/재처리 보장
- [ ] 원문 protobuf 디코딩과 상세 통계 입력 생성

### Stage C — local statistics

- [ ] 선택 기간/탁의 통계를 MariaDB 데이터로 직접 계산
- [ ] 기존 amae-koromo `player_stats`/`extended_stats` 요청 제거
- [ ] 기존 amae-koromo 과거 자료와 자체 수집 자료의 중복 정리

### Stage D — source independence

- [ ] 플레이어 검색/닉네임 인덱스를 자체 DB 기준으로 전환
- [ ] amae-koromo HTTP API를 신규 데이터 경로에서 제거
- [ ] collector를 기본 상시 서비스로 활성화
- [ ] 운영 모니터링/재접속/백오프/데이터 보존 정책 확정

## Important limitation

live-list 방식은 collector가 처음 가동되기 전의 동탁/은탁 전체 과거 자료를 자동 복구하지 못한다. 신규 자료는 자체 collector로 계속 축적하고, 과거 자료를 추가로 확보할 수 있는 별도 경로가 확인되면 backfill 단계로 분리한다.
