# 문제 해결 가이드

## 플레이어 검색 결과가 비어있음

### 증상
- 플레이어 검색 시 빈 배열 `[]` 반환
- 알려진 플레이어 닉네임이나 ID로 검색해도 결과 없음

### 진단

1. **로컬 캐시 확인**
   ```sql
   SELECT COUNT(*) FROM cached_players;
   SELECT * FROM cached_players ORDER BY last_updated_at DESC LIMIT 10;
   ```
   
   캐시가 비어있으면 collector가 아직 데이터를 수집하지 않았거나 검색이 한 번도 실행되지 않은 것입니다.

2. **Collector 상태 확인**
   ```bash
   docker compose ps collector
   docker compose logs collector --tail=50
   ```
   
   Collector가 실행 중이고 "connected account=..." 메시지가 있는지 확인합니다.

3. **애플리케이션 로그 확인**
   ```bash
   docker compose logs app --tail=50 | grep "player-search"
   ```
   
   다음과 같은 메시지를 찾습니다:
   - `native fallback failed`: collector 연결 실패
   - `ECONNREFUSED`: collector 서비스가 다운되었거나 접근 불가
   - `HTTP 502/503`: collector가 인증 실패 또는 Mahjong Soul 연결 문제

### 해결 방법

#### Collector가 실행되지 않음

```bash
docker compose up -d collector
docker compose logs collector -f
```

"connected account=..." 메시지가 나타날 때까지 기다립니다.

#### Collector 인증 실패

Collector 로그에서 다음과 같은 에러를 찾습니다:
- `oauth2Auth failed`
- `ERR_OAUTH2_FAILED code 110`
- `oauth2Auth(type=23) failed`

**원인**: 잘못된 자격 증명 또는 오래된 resource version

**해결**:

1. `.env` 파일의 Mahjong Soul 자격 증명 확인:
   ```bash
   MAJSOUL_UID=your-uid
   MAJSOUL_TOKEN=your-token
   MAJSOUL_DEVICE_ID=your-device-id
   MAJSOUL_OAUTH_TYPE=23
   MAJSOUL_LOGIN_REGION=kr
   MAJSOUL_RESOURCE_VERSION=0.16.238
   ```

2. Resource version 업데이트:
   - 브라우저에서 Mahjong Soul 접속
   - 개발자 도구 → Network → WS 탭
   - WebSocket 연결의 `oauth2Auth` 메시지에서 `client_version_string` 확인
   - 예: `WebGL_2022-0.16.238` → `MAJSOUL_RESOURCE_VERSION=0.16.238`

3. Collector 재시작:
   ```bash
   docker compose restart collector
   docker compose logs collector -f
   ```

#### Collector는 작동하지만 검색 결과 없음

Collector는 **라이브 게임만** 수집합니다. 특정 플레이어의 과거 레코드를 가져오지 않습니다.

따라서:
1. Collector가 실행된 후 시간이 지나야 데이터가 쌓입니다.
2. 검색한 플레이어가 최근에 게임을 하지 않았다면 데이터가 없을 수 있습니다.
3. 검색하면 플레이어가 `cached_players`에 저장되지만, 게임 레코드는 collector가 발견할 때까지 없습니다.

**현재 제한사항**: Stage 2 데이터 수집 로직이 구현되지 않아, 플레이어별 과거 레코드를 가져오는 기능이 없습니다.

## 플레이어 페이지에 "수집된 대국 기록이 없습니다" 표시

### 증상
- 플레이어 검색은 성공
- 플레이어 페이지에 접근 가능
- 하지만 통계가 표시되지 않고 "수집된 대국 기록이 없습니다" 메시지

### 원인
Collector가 해당 플레이어의 게임을 아직 수집하지 않았습니다.

### 해결 방법

1. **대기**: Collector가 라이브 게임을 모니터링하면서 해당 플레이어의 게임을 발견하면 자동으로 수집됩니다.

2. **게임 레코드 확인**:
   ```sql
   SELECT COUNT(*) 
   FROM cached_player_game_records 
   WHERE cached_player_id IN (
     SELECT id FROM cached_players WHERE player_id = 'PLAYER_ID'
   );
   ```

3. **Collector 로그 확인**: 게임 수집 활동을 확인합니다.
   ```bash
   docker compose logs collector --tail=100 | grep "collected\|materialized"
   ```

## HTTP 429 (Too Many Requests)

### 증상
- 이전 버전에서 플레이어 페이지 접근 시 HTTP 429 에러
- "x-cap-token-required" 메시지

### 원인
이전 시스템에서 클라이언트가 외부 API를 직접 호출하면서 rate limit에 걸렸습니다.

### 해결
현재 버전에서는 모든 데이터 요청이 서버 사이드 API (`/api/players/[id]`)를 통해 처리되므로 이 문제가 해결되었습니다.

만약 여전히 429 에러가 발생한다면:
1. 캐시를 지우고 페이지를 새로고침합니다.
2. 브라우저 개발자 도구 → Network 탭에서 어떤 요청이 429를 반환하는지 확인합니다.
3. `/api/external/` 경로로의 요청이 429를 반환하면 외부 API 미러가 일시적으로 제한하는 것일 수 있습니다.

## Collector 게임 수집이 느림

### 증상
- Collector가 실행 중
- 하지만 게임 데이터가 거의 쌓이지 않음

### 진단

```bash
docker compose logs collector --tail=200
```

다음을 확인합니다:
- 라이브 게임 발견: `live games` 메시지의 숫자
- 게임 수집 속도: `collected` 메시지 빈도
- 에러 메시지: `failed`, `retry` 등

### 해결 방법

1. **수집 대기 시간 조정**:
   ```bash
   COLLECTOR_RECORD_DELAY_MS=600000  # 10분 (기본: 20분)
   ```

2. **배치 크기 증가**:
   ```bash
   COLLECTOR_RECORD_BATCH_SIZE=50  # 기본: 20
   ```

3. **폴링 간격 감소**:
   ```bash
   COLLECTOR_POLL_INTERVAL_MS=5000  # 5초 (기본: 7초)
   ```

주의: 너무 공격적인 설정은 Mahjong Soul 서버에 부담을 줄 수 있습니다.

## 데이터베이스 마이그레이션 실패

### 증상
- 애플리케이션 시작 시 마이그레이션 에러
- `migrate` 서비스가 실패

### 해결

1. **로그 확인**:
   ```bash
   docker compose logs migrate
   ```

2. **수동 마이그레이션**:
   ```bash
   docker compose run --rm app npm run db:migrate:deploy
   ```

3. **마이그레이션 상태 확인**:
   ```sql
   SELECT * FROM _prisma_migrations ORDER BY finished_at DESC;
   ```

4. **데이터베이스 백업**:
   마이그레이션 실행 전에 항상 백업하세요:
   ```bash
   docker compose exec mariadb mysqldump -u ppong_nya -p ppong_nya > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

## Collector 인증 정보 업데이트

### Mahjong Soul 자격 증명 갱신

1. 브라우저에서 Mahjong Soul에 로그인
2. 개발자 도구 → Application/Storage → Cookies
3. 다음 값을 찾습니다:
   - `uid` → `MAJSOUL_UID`
   - `token` → `MAJSOUL_TOKEN`
   - `deviceId` → `MAJSOUL_DEVICE_ID`

4. `.env` 파일 업데이트:
   ```bash
   MAJSOUL_UID=new-uid
   MAJSOUL_TOKEN=new-token
   MAJSOUL_DEVICE_ID=new-device-id
   ```

5. Collector 재시작:
   ```bash
   docker compose restart collector
   ```

### Resource version 확인

1. 브라우저에서 Mahjong Soul WebSocket 연결 캡처
2. `oauth2Auth` 메시지에서 `client_version_string` 확인
3. 버전 추출: `WebGL_2022-X.Y.Z` → `X.Y.Z`
4. `.env` 업데이트 및 collector 재시작

## 유용한 디버깅 쿼리

### 최근 캐시된 플레이어
```sql
SELECT player_id, nickname, level, last_updated_at
FROM cached_players
ORDER BY last_updated_at DESC
LIMIT 20;
```

### 플레이어별 게임 수
```sql
SELECT cp.player_id, cp.nickname, COUNT(*) as game_count
FROM cached_players cp
JOIN cached_player_game_records cpgr ON cp.id = cpgr.cached_player_id
GROUP BY cp.id
ORDER BY game_count DESC
LIMIT 20;
```

### 최근 수집된 게임
```sql
SELECT uuid, mode_id, started_at, table_name
FROM game_records
WHERE source = 'majsoul-native'
ORDER BY started_at DESC
LIMIT 20;
```

### Collector 상태
```sql
SELECT * FROM collector_state ORDER BY heartbeat_at DESC LIMIT 1;
```

### Collector 대기 중인 게임
```sql
SELECT status, COUNT(*) as count
FROM collector_games
GROUP BY status;
```
