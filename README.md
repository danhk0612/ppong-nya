# 퐁냐(ppong-nya)

퐁냐(ppong-nya)는 작혼(雀魂, Mahjong Soul) 전적, 랭킹, 통계를 한국어 중심으로 확인하고 관리하기 위한 SvelteKit 기반 웹 서비스입니다. 현재 MVP는 Google OAuth 로그인, 사용자별 대국 기록/설정/즐겨찾기/메모 저장, 모바일 우선 UI를 중심으로 구성되어 있습니다.

## 프로젝트 소개

- 서비스명: `퐁냐(ppong-nya)`
- 목적: 작혼 플레이어가 본인의 대국 기록과 관련 데이터를 한곳에서 조회하고 관리할 수 있는 한국어 허브 제공
- 기본 UI 언어: 한국어
- 인증 방식: `@auth/sveltekit` + Google OAuth
- 데이터 저장소: MariaDB 호환 MySQL 데이터베이스 + Prisma ORM

## 주요 기능

- Google OAuth 기반 로그인 및 세션 관리
- 사용자 계정별 데이터 저장
  - 사용자 설정
  - 즐겨찾기 플레이어
  - 대국 기록
  - 대국 메모
  - 검색 기록 및 통계 캐시를 위한 Prisma 모델
- 저장한 대국 기록 목록 및 상세 화면
- SvelteKit 서버 라우트 기반 CRUD API
- 한국어 중심 i18n 리소스 구조
- 모바일 우선 카드/표 UI 컴포넌트
- Docker 및 Docker Compose 기반 실행 구성

## 기술 스택

- 런타임: `Node.js` 20 이상, `npm` 10 이상
- 프레임워크: `SvelteKit` 2, `Svelte` 5, `Vite` 5
- 스타일링: `Tailwind CSS`, `PostCSS`, `Autoprefixer`
- 인증: `@auth/sveltekit`, `@auth/prisma-adapter`, Google OAuth
- 데이터베이스: `MariaDB` 11.4 또는 MySQL 호환 데이터베이스
- ORM: `Prisma` 6, `@prisma/client`
- 기타: `TypeScript`, `dayjs`, `i18next`

## 사전 요구사항

로컬 개발을 시작하기 전에 다음 도구가 필요합니다.

- `Node.js >= 20.0.0`
- `npm >= 10.0.0`
- `Docker` 및 `Docker Compose` 플러그인
- Google OAuth 클라이언트를 만들 수 있는 Google Cloud 프로젝트
- 로컬 또는 원격 MariaDB/MySQL 데이터베이스

## 환경 변수

로컬 개발에서는 저장소 루트의 `.env.example`을 복사해 `.env`를 만들고 값을 채웁니다.

```bash
cp .env.example .env
```

| 변수명 | 필수 여부 | 노출 범위 | 예시 | 설명 |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | 필수 | 서버 전용 | `mysql://USER:PASSWORD@HOST:3306/ppong_nya?connection_limit=5&pool_timeout=10&connect_timeout=10` | Prisma가 사용하는 MariaDB/MySQL 연결 문자열입니다. |
| `AUTH_SECRET` | 필수 | 서버 전용 | `openssl rand -base64 32`로 생성한 긴 문자열 | Auth.js/SvelteKitAuth 쿠키와 토큰 서명/암호화에 사용하는 비밀값입니다. |
| `GOOGLE_CLIENT_ID` | 필수 | 서버 전용 | `replace-with-google-client-id.apps.googleusercontent.com` | Google OAuth 클라이언트 ID입니다. |
| `GOOGLE_CLIENT_SECRET` | 필수 | 서버 전용 | `replace-with-google-client-secret` | Google OAuth 클라이언트 보안 비밀입니다. |
| `PUBLIC_SITE_NAME` | 선택 | 공개 | `퐁냐` | 공개 사이트명입니다. 값이 없으면 코드에서 `퐁냐`를 기본값으로 사용합니다. |
| `PUBLIC_SITE_URL` | 필수 | 공개 | `http://localhost:5173` | 서비스의 기준 URL입니다. OAuth 리다이렉트 검증과 공개 런타임 설정에 사용됩니다. |
| `ORIGIN` | 배포 시 권장 | 서버 런타임 | `https://ppong-nya.com` | `@sveltejs/adapter-node` 실행 시 요청 origin 검증에 사용하는 값입니다. Docker 예시는 `http://localhost:3000`을 사용합니다. |
| `HOST` | 배포 시 권장 | 서버 런타임 | `0.0.0.0` | Node adapter 서버가 바인딩할 호스트입니다. |
| `PORT` | 배포 시 권장 | 서버 런타임 | `3000` | Node adapter 서버 포트입니다. |
| `NODE_ENV` | 배포 시 권장 | 서버 런타임 | `production` | 프로덕션 런타임 여부를 나타냅니다. |

주의사항:

- `DATABASE_URL`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`은 서버 전용 값이므로 `PUBLIC_` 접두사를 붙이지 않습니다.
- `PUBLIC_SITE_URL`은 브라우저 번들에서도 접근 가능한 공개 값입니다. 실제 비밀값을 넣지 않습니다.
- 프로덕션에서는 `PUBLIC_SITE_URL`과 `ORIGIN`을 실제 HTTPS 도메인으로 맞추는 것을 권장합니다.
- Prisma 연결 문자열에는 커넥션 풀 정책을 명시할 수 있습니다. 코드에서는 누락 시 개발 환경 `connection_limit=5`, 프로덕션 `connection_limit=10`, 공통 `pool_timeout=10`, `connect_timeout=10`을 기본으로 보정합니다.

## 로컬 개발 실행

1. 의존성을 설치합니다.

   ```bash
   npm install
   ```

2. 환경 변수 파일을 준비합니다.

   ```bash
   cp .env.example .env
   ```

3. MariaDB를 실행합니다. Docker Compose의 `db` 서비스만 사용할 수 있습니다.

   ```bash
   docker compose up -d db
   ```

4. `.env`의 `DATABASE_URL`을 로컬 DB에 맞춥니다.

   ```env
   DATABASE_URL="mysql://ppong_nya:ppong_nya_password@localhost:3306/ppong_nya?connection_limit=5&pool_timeout=10&connect_timeout=10"
   PUBLIC_SITE_URL="http://localhost:5173"
   ```

5. Prisma Client를 생성하고 개발용 마이그레이션을 적용합니다.

   ```bash
   npm run db:generate
   npm run db:migrate:dev
   ```

6. 개발 서버를 실행합니다.

   ```bash
   npm run dev
   ```

7. 브라우저에서 `http://localhost:5173`에 접속합니다.

## MariaDB/Prisma 설정

Prisma 설정은 `prisma/schema.prisma`에 있으며, datasource provider는 `mysql`입니다. MariaDB는 MySQL 호환 프로토콜을 사용하므로 `DATABASE_URL`도 `mysql://` 형식으로 작성합니다.

자주 사용하는 명령은 다음과 같습니다.

```bash
npm run db:generate       # Prisma Client 생성
npm run db:migrate:dev    # 개발 환경 마이그레이션 생성/적용
npm run db:migrate:deploy # 배포 환경 마이그레이션 적용
npm run db:push           # 스키마를 DB에 직접 반영
npm run db:studio         # Prisma Studio 실행
```

로컬 Docker Compose DB 기본값은 다음과 같습니다.

| 항목 | 값 |
| --- | --- |
| 데이터베이스 | `ppong_nya` |
| 사용자 | `ppong_nya` |
| 비밀번호 | `ppong_nya_password` |
| 호스트 | 로컬 개발: `localhost`, Compose 내부 앱: `db` |
| 포트 | `3306` |

Compose 내부 앱에서 사용하는 연결 문자열 예시는 다음과 같습니다.

```env
DATABASE_URL="mysql://ppong_nya:ppong_nya_password@db:3306/ppong_nya"
```

## Google OAuth 설정

1. Google Cloud Console에서 OAuth 동의 화면을 구성합니다.
2. OAuth 클라이언트 유형은 웹 애플리케이션으로 생성합니다.
3. 로컬 개발용 승인된 JavaScript 원본을 추가합니다.

   ```text
   http://localhost:5173
   ```

4. 로컬 개발용 승인된 리디렉션 URI를 추가합니다.

   ```text
   http://localhost:5173/auth/callback/google
   ```

5. 발급받은 값을 `.env`에 입력합니다.

   ```env
   GOOGLE_CLIENT_ID="replace-with-google-client-id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="replace-with-google-client-secret"
   AUTH_SECRET="replace-with-a-long-random-secret"
   PUBLIC_SITE_URL="http://localhost:5173"
   ```

6. 프로덕션에서는 실제 도메인 기준으로 원본과 리디렉션 URI를 추가합니다.

   ```text
   https://ppong-nya.com
   https://ppong-nya.com/auth/callback/google
   ```

## Docker 실행

전체 서비스를 Docker Compose로 실행할 수 있습니다.

```bash
AUTH_SECRET="$(openssl rand -base64 32)" \
GOOGLE_CLIENT_ID="replace-with-google-client-id.apps.googleusercontent.com" \
GOOGLE_CLIENT_SECRET="replace-with-google-client-secret" \
docker compose up --build
```

Docker Compose의 기본 앱 URL은 `http://localhost:3000`입니다. 프로덕션 또는 실제 OAuth 테스트에서는 앱 서비스 환경 변수에 다음 값도 함께 맞추는 것을 권장합니다.

```yaml
environment:
  PUBLIC_SITE_URL: http://localhost:3000
  ORIGIN: http://localhost:3000
```

이미지를 직접 빌드하고 실행할 수도 있습니다.

```bash
docker build --target runtime -t ppong-nya .
docker run --rm -p 3000:3000 \
  -e HOST=0.0.0.0 \
  -e PORT=3000 \
  -e ORIGIN=http://localhost:3000 \
  -e PUBLIC_SITE_URL=http://localhost:3000 \
  -e DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/ppong_nya" \
  -e AUTH_SECRET="replace-with-a-long-random-secret" \
  -e GOOGLE_CLIENT_ID="replace-with-google-client-id.apps.googleusercontent.com" \
  -e GOOGLE_CLIENT_SECRET="replace-with-google-client-secret" \
  ppong-nya
```

컨테이너 환경에서 데이터베이스 스키마를 반영하려면 배포 과정에서 다음 명령을 별도로 실행합니다.

```bash
npm run db:migrate:deploy
```

## 테스트 및 검증 명령

변경 사항을 검증할 때 다음 명령을 사용합니다.

```bash
npm run check
npm run build
npm run db:generate
npm run db:migrate:deploy
```

명령별 용도는 다음과 같습니다.

- `npm run check`: SvelteKit 동기화와 `svelte-check` 타입 검사를 실행합니다.
- `npm run build`: 프로덕션 빌드를 생성합니다.
- `npm run db:generate`: Prisma Client를 생성합니다.
- `npm run db:migrate:deploy`: 이미 생성된 Prisma 마이그레이션을 배포 환경 데이터베이스에 적용합니다.

현재 별도의 단위 테스트 스크립트는 정의되어 있지 않습니다. 테스트 스크립트를 추가하면 이 섹션에 함께 기록해 주세요.

## 배포 참고사항

- 배포 전에 `npm run check`와 `npm run build`를 실행합니다.
- 프로덕션 데이터베이스에는 `npm run db:migrate:deploy`로 Prisma 마이그레이션을 적용합니다.
- `AUTH_SECRET`은 충분히 긴 랜덤 문자열을 사용하고 비밀 관리자에 저장합니다.
- `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`은 서버 전용 환경 변수로 관리합니다.
- `PUBLIC_SITE_URL`과 `ORIGIN`은 실제 HTTPS canonical origin으로 설정합니다.
- Google OAuth 승인된 리디렉션 URI에 `https://your-domain.example/auth/callback/google` 형식을 반드시 등록합니다.
- Node adapter 런타임은 기본적으로 `node build`로 시작합니다.
- 여러 앱 인스턴스를 실행할 경우 `DATABASE_URL`의 `connection_limit`을 MariaDB 최대 연결 수와 인스턴스 수에 맞춰 조정합니다.

## 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다. 자세한 내용은 [LICENSE](./LICENSE)를 참고하세요.
