# 퐁냐 (ppong-nya)

퐁냐는 작혼(Mahjong Soul) 4인전 플레이어의 전적과 통계를 기간·탁 종류별로 조회하는 한국어 웹 서비스입니다.

운영 주소: https://ppong-nya.mydepot.kr

## 주요 기능

- 작혼 닉네임 또는 숫자 플레이어 ID 검색
- 플레이어 페이지를 닉네임 또는 ID로 직접 접근
- 검색한 플레이어와 대국 데이터를 서버 공용 캐시에 저장
- 저장된 데이터 우선 사용 후 부족하거나 오래된 데이터만 추가 수집
- 최근 7일 / 30일 / 90일 / 6개월 / 1년 / 직접 지정 기간 조회
- 금·옥·왕좌 및 동풍전/남풍전 탁 종류 필터
- 선택한 기간과 탁 기준 통계 재계산
- 플레이어 페이지 접근 시 오래된 데이터 자동 갱신
- 수동 새로고침 지원
- 4인전만 지원

회원가입, 로그인, 사용자별 즐겨찾기 기능은 사용하지 않습니다.

## 데이터 보관

검색한 플레이어 데이터는 모든 방문자가 공유하는 서버 캐시에 저장됩니다.

기본 보관 정책:

- 마지막 접근 후 90일이 지난 플레이어 캐시 정리
- 플레이어당 최대 2,000전 유지
- 만료된 통계/API 캐시 정리
- 다른 플레이어에서도 참조하지 않는 외부 대국 데이터 정리

다음 환경 변수로 변경할 수 있습니다.

```env
PLAYER_CACHE_RETENTION_DAYS=90
PLAYER_CACHE_MAX_RECORDS=2000
```

## 기술 구성

- SvelteKit 2 / Svelte 5 / TypeScript
- MariaDB 11.4
- Prisma 6
- Docker / Docker Compose
- Oracle Cloud ARM64 운영
- Nginx Proxy Manager

외부 데이터 요청은 애플리케이션 서버의 프록시를 거치며 기존 CAP 프록시 및 응답 압축 처리를 유지합니다.

## 로컬 실행

### 환경 변수

`.env.example`을 복사합니다.

```bash
cp .env.example .env
```

필수 값은 `DATABASE_URL`, `PUBLIC_SITE_URL`입니다.

예시:

```env
DATABASE_URL="mysql://ppong_nya:password@127.0.0.1:3306/ppong_nya?connection_limit=5&pool_timeout=10&connect_timeout=10"
PUBLIC_SITE_URL="http://localhost:5173"
PUBLIC_SITE_NAME="퐁냐"
PLAYER_CACHE_RETENTION_DAYS="90"
PLAYER_CACHE_MAX_RECORDS="2000"
```

### 개발 서버

```bash
npm ci
npm run db:generate
npm run db:migrate:deploy
npm run dev
```

### Docker Compose

```bash
docker compose up --build
```

기본 주소는 `http://localhost:3000`입니다.

## 운영 배포

`master` 브랜치가 갱신되면 GitHub Actions가 AMD64/ARM64 이미지를 빌드해 다음 태그로 게시합니다.

```text
ghcr.io/danhk0612/ppong-nya:latest
```

Oracle Cloud 운영 절차는 [`docs/oracle-cloud-deployment.md`](docs/oracle-cloud-deployment.md)를 참고합니다.

운영 갱신의 기본 순서는 다음과 같습니다.

```bash
git pull --ff-only
docker compose --env-file .env -f compose.production.yml -f compose.oracle.yml pull
docker compose --env-file .env -f compose.production.yml -f compose.oracle.yml up -d
docker compose --env-file .env -f compose.production.yml -f compose.oracle.yml ps
```

`migrate` 서비스가 애플리케이션 시작 전에 Prisma 마이그레이션을 적용합니다.

## 검증

Pull Request CI에서 다음을 확인합니다.

- MariaDB 11.4에 전체 Prisma 마이그레이션 적용
- Prisma Client 생성
- Svelte/TypeScript 검사
- 애플리케이션 빌드
- Docker Compose 구성 검증
- AMD64/ARM64 컨테이너 이미지 빌드

## 관련 문서

- [`docs/public-player-cache-plan.md`](docs/public-player-cache-plan.md): 공용 플레이어 캐시 개편 계획
- [`docs/public-player-cache-progress.md`](docs/public-player-cache-progress.md): 단계별 진행 상태
- [`docs/external-api-plan.md`](docs/external-api-plan.md): 외부 API/프록시 구조
- [`docs/oracle-cloud-deployment.md`](docs/oracle-cloud-deployment.md): Oracle Cloud 운영 배포
