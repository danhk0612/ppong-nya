# Stage 2 구현 검증 가이드

## 구현 내용

PR #75에서 Stage 2의 핵심 데이터 수집 로직("pull path")을 구현했습니다:

### 주요 기능

1. **외부 API 레코드 가져오기**
   - `player_records/:playerId/:cursor/:start` 엔드포인트 사용
   - 100개 레코드 페이지네이션
   - 4인전 모드만 지원

2. **UUID 기반 중복 제거**
   - 소스: `amae-koromo` (외부 API)
   - UUID 또는 _id로 기존 레코드 확인
   - 중복 시 스킵, 신규만 저장

3. **데이터 저장**
   - `GameRecord` 테이블: 게임 메타데이터
   - `Player` 테이블: 게임 내 플레이어 정보
   - `CachedPlayerGameRecord`: 플레이어-게임 연결

4. **Stale 감지**
   - 24시간 TTL (`lastUpdatedAt` 기준)
   - 자동 갱신 트리거

5. **강제 새로고침**
   - `POST /api/players/[id]`로 강제 갱신
   - UI의 "새로고침" 버튼 사용

## 로컬 검증

### 사전 준비

```bash
# 저장소 최신화
git checkout master
git pull
git checkout cursor/fix-build-and-search-74ed
git pull

# 의존성 및 DB 설정
npm ci
npm run db:generate
npm run db:migrate:deploy

# 환경 변수 설정 (.env)
DATABASE_URL="mysql://user:pass@localhost:3306/ppong_nya"
PUBLIC_SITE_URL="http://localhost:5173"
```

### 빌드 검증

```bash
npm run check
npm run build
```

예상 결과:
```
✓ svelte-check found 0 errors and 0 warnings
✓ built in ~3s
```

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

### 기능 테스트

#### 1. 플레이어 검색

1. 홈 페이지에서 알려진 플레이어 닉네임 또는 ID 검색
   - 예: 한국 마작혼 플레이어의 숫자 ID

2. 검색 결과 확인
   - 로컬 캐시에서 찾으면 즉시 반환
   - 없으면 native collector 폴백 시도
   - Collector 없으면 빈 배열 (에러 로그 확인)

**로그 확인**:
```
[player-search] local cache miss for query="..."
[player-search] native collector returned N results
```

#### 2. 플레이어 페이지 - 첫 접근 (upstream fetch)

1. 검색된 플레이어 클릭 또는 `/player/[id]` 직접 접근

2. **콘솔 로그 확인** (브라우저 개발자 도구):
   ```
   [public-player-cache] refreshing data playerId=... recordCount=0
   [public-player-cache] fetching upstream records path=player_records/...
   [public-player-cache] fetched N upstream records
   [public-player-cache] stored M/N records
   ```

3. **페이지 표시**:
   - 플레이어 정보 (닉네임, ID, 레벨)
   - 조회 조건 (기간, 탁 종류)
   - 통계 (순위 분포, 핵심 지표)
   - 대국 기록 목록

**예상 동작**:
- 외부 API에서 레코드 가져오기 (수 초 소요)
- DB에 저장 후 페이지 표시
- 이후 접근은 캐시 사용 (즉시 표시)

#### 3. 플레이어 페이지 - 재접근 (cache hit)

1. 같은 플레이어 페이지를 다시 열기

2. **콘솔 로그**:
   - upstream fetch 없음 (stale 아니면)
   - 기존 레코드만 조회

3. **페이지 표시**:
   - 즉시 로드 (캐시에서)

#### 4. 강제 새로고침

1. 플레이어 페이지에서 "새로고침" 버튼 클릭

2. **콘솔 로그 확인**:
   ```
   [public-player-cache] refreshing data playerId=... forceRefresh=true
   [public-player-cache] fetching upstream records...
   ```

3. **페이지 갱신**:
   - 최신 레코드 가져오기
   - 통계 재계산

#### 5. Rate Limit (429) 및 Cooldown 동작

**목적**: Upstream API rate limit 발생 시 자동 cooldown이 정상 작동하는지 확인

1. **Rate limit 유도** (선택 사항, 조심해서 수행):
   - 레코드가 없는 여러 플레이어 페이지를 연속으로 빠르게 접근
   - 또는 외부 API 미러가 이미 rate limit 상태일 때 테스트

2. **429 발생 시 콘솔 로그**:
   ```
   [public-player-cache] refreshing data playerId=... recordCount=0
   [public-player-cache] fetching upstream records path=player_records/...
   [public-player-cache] upstream fetch failed status=429
   [public-player-cache] rate limited (429) for playerId=..., cooldown active for 10 minutes
   ```

3. **UI 메시지 확인**:
   - "외부 API 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요."

4. **Cooldown 동작 확인**:
   - 같은 플레이어 페이지를 즉시 다시 열기
   - 콘솔 로그:
     ```
     [public-player-cache] skipping refresh due to cooldown playerId=... lastUpdatedAt=...
     ```
   - UI 메시지:
     - "최근 시도 후 잠시 대기 중입니다. 잠시 후 다시 시도해주세요."

5. **Cooldown 후 재시도**:
   - 10분 후 같은 플레이어 페이지 다시 접근
   - Upstream fetch 재시도 확인

**예상 동작**:
- 429 에러 발생 시 즉시 10분 cooldown 적용
- Cooldown 기간 내에는 추가 upstream 요청 안 함
- 매 요청마다 429를 유발하지 않음 (무한 재시도 방지)
- 이미 레코드가 있는 플레이어는 cooldown 영향 없음

**DB 확인**:
```sql
-- Cooldown 중인 플레이어 확인
SELECT player_id, nickname, last_updated_at,
       TIMESTAMPDIFF(MINUTE, last_updated_at, NOW()) as minutes_ago
FROM cached_players
WHERE last_updated_at > NOW() - INTERVAL 10 MINUTE
  AND (SELECT COUNT(*) FROM cached_player_game_records 
       WHERE cached_player_id = cached_players.id) = 0
ORDER BY last_updated_at DESC;
```

#### 6. Source 통합 검증

**목적**: Upstream (amae-koromo)과 Native (collector)에서 수집한 레코드가 모두 표시되는지 확인

1. **Collector로 수집된 플레이어**:
   - Collector가 실행 중일 때 라이브 게임을 플레이한 플레이어 확인
   - 해당 플레이어 페이지 접근
   - Native 레코드 확인

2. **Upstream API에서 가져온 레코드 추가**:
   - "새로고침" 버튼으로 강제 upstream fetch
   - 추가 레코드 확인

3. **통합 표시 확인**:
   ```sql
   SELECT gr.source, COUNT(*) as count
   FROM cached_players cp
   JOIN cached_player_game_records cpgr ON cp.id = cpgr.cached_player_id
   JOIN game_records gr ON cpgr.game_record_id = gr.id
   WHERE cp.player_id = 'PLAYER_ID'
   GROUP BY gr.source;
   ```
   
   기대 결과:
   ```
   majsoul-native | X
   amae-koromo    | Y
   ```

4. **UI에서 확인**:
   - 플레이어 페이지의 대국 기록 목록에 두 소스의 레코드가 모두 표시
   - 통계가 모든 레코드를 포함하여 계산됨

#### 7. 기간/탁 필터

1. 플레이어 페이지에서 기간 선택:
   - 최근 7일
   - 최근 30일 (기본)
   - 최근 90일
   - 직접 지정

2. 탁 종류 선택:
   - 전체
   - 금탁, 옥탁, 왕좌탁
   - 동풍전, 남풍전

3. "조회" 버튼 클릭

4. **동작**:
   - 선택한 범위/모드에 맞는 레코드 필터링
   - 통계 재계산
   - URL 쿼리 파라미터 업데이트

### 데이터베이스 확인

#### 가져온 레코드 확인

```sql
-- 외부 API에서 가져온 게임 레코드
SELECT id, uuid, source, external_mode_id, started_at
FROM game_records
WHERE source = 'amae-koromo'
ORDER BY started_at DESC
LIMIT 10;

-- 특정 플레이어의 연결된 게임
SELECT 
  cp.player_id,
  cp.nickname,
  COUNT(*) as game_count,
  MAX(gr.started_at) as latest_game
FROM cached_players cp
JOIN cached_player_game_records cpgr ON cp.id = cpgr.cached_player_id
JOIN game_records gr ON cpgr.game_record_id = gr.id
WHERE cp.player_id = 'PLAYER_ID'
GROUP BY cp.id;

-- 플레이어별 소스 분포
SELECT 
  cp.nickname,
  gr.source,
  COUNT(*) as count
FROM cached_players cp
JOIN cached_player_game_records cpgr ON cp.id = cpgr.cached_player_id
JOIN game_records gr ON cpgr.game_record_id = gr.id
GROUP BY cp.id, gr.source
ORDER BY cp.nickname, gr.source;
```

## 프로덕션 배포 후 검증

### 1. 배포

```bash
# 서버에서
cd /path/to/ppong-nya
git pull --ff-only
docker compose --env-file .env -f compose.production.yml -f compose.oracle.yml pull
docker compose --env-file .env -f compose.production.yml -f compose.oracle.yml up -d
```

### 2. 로그 모니터링

```bash
# 애플리케이션 로그
docker compose logs app -f --tail=100

# 주요 확인 사항
# - [public-player-cache] 메시지
# - upstream fetch 성공/실패
# - 저장된 레코드 수
```

### 3. API 테스트

```bash
# 플레이어 검색
curl "https://ppong-nya.mydepot.kr/api/players/search?q=테스트" | jq

# 플레이어 데이터 (GET = 자동 갱신)
curl "https://ppong-nya.mydepot.kr/api/players/124885726?from=2026-08-01T00:00:00.000Z&to=2026-09-11T23:59:59.999Z" | jq

# 강제 새로고침 (POST)
curl -X POST "https://ppong-nya.mydepot.kr/api/players/124885726?from=2026-08-01T00:00:00.000Z&to=2026-09-11T23:59:59.999Z" | jq
```

### 4. 브라우저 테스트

1. 알려진 플레이어 검색
2. 플레이어 페이지 접근
3. 통계 표시 확인
4. 새로고침 버튼 동작 확인
5. 기간/탁 필터 변경

### 5. 성능 확인

- 첫 접근: 외부 API 호출로 인해 수 초 소요 (정상)
- 재접근: 캐시에서 즉시 로드 (정상)
- 24시간 후: 자동 stale 감지 및 재갱신

## 알려진 제한사항

1. **단일 페이지 fetch**
   - 현재: 100개 레코드만 가져옴
   - 향후: 다중 페이지 pagination 구현 필요

2. **범위 추적 없음**
   - `PlayerQueryCoverage` 테이블 미구현
   - 매번 전체 범위 다시 fetch
   - 향후: 증분 갱신 최적화 필요

3. **통계 캐싱 없음**
   - `PlayerStatisticsCache` 테이블 미구현
   - 매번 레코드에서 통계 재계산
   - 향후: 통계 캐싱으로 성능 개선

4. **외부 API 의존**
   - 외부 API 다운 시 신규 데이터 가져올 수 없음
   - 기존 캐시는 계속 작동
   - Collector 수집 게임은 영향 없음

## 문제 해결

### 외부 API fetch 실패

**로그**:
```
[public-player-cache] upstream fetch failed: HTTP 429
[public-player-cache] upstream fetch failed: HTTP 502
```

**원인**:
- 429: Rate limiting
- 502: 외부 API 미러 다운

**해결**:
- 잠시 후 재시도 (캐시 있으면 계속 작동)
- 외부 API 미러 상태 확인

### 레코드 저장 실패

**로그**:
```
[public-player-cache] failed to store record uuid=...
```

**원인**:
- DB 연결 문제
- 데이터 형식 불일치
- 제약 조건 위반

**해결**:
- DB 연결 확인
- 로그에서 상세 에러 확인
- 문제 레코드 스킵하고 계속 진행

### 통계 미표시

**증상**: 플레이어 페이지에서 "수집된 대국 기록이 없습니다"

**확인**:
1. 로그에서 fetch 시도 확인
2. DB에 레코드 저장되었는지 확인
3. 기간/모드 필터가 레코드와 일치하는지 확인

## 다음 단계

Stage 2 완성을 위해 추가 구현 고려:

1. **다중 페이지 pagination**: 100개 이상 레코드 가져오기
2. **PlayerQueryCoverage**: 범위 추적으로 증분 갱신
3. **PlayerStatisticsCache**: 통계 캐싱으로 성능 개선
4. **에러 처리 개선**: 외부 API 실패 시 더 나은 폴백
5. **Rate limiting**: 외부 API 호출 빈도 제한
