# 배포 가이드

이 프로젝트는 `@sveltejs/adapter-node`를 사용해 SvelteKit Node 서버로 빌드됩니다. Docker 이미지는 빌드 단계에서 의존성 설치와 애플리케이션 빌드를 수행하고, 런타임 단계에는 빌드 산출물과 production dependencies만 포함합니다.

## 사전 준비

- 로컬 개발용 Node.js 20 이상
- npm 10 이상
- 커밋된 `package-lock.json` 기반 의존성 설치
- 컨테이너 실행용 Docker 및 Docker Compose
- 영속 데이터가 필요한 환경에서 사용할 MariaDB 호환 데이터베이스

## 런타임 환경 변수

아래 값은 호스팅 플랫폼, `docker run -e`, Docker Compose `environment`, 또는 시크릿 매니저를 통해 주입하세요.

| 변수                   | 예시                                            | 설명                                                                                        |
| ---------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | `mysql://ppong_nya:password@db:3306/ppong_nya`  | 애플리케이션에서 사용할 MariaDB 연결 문자열입니다.                                          |
| `GOOGLE_CLIENT_ID`     | `1234567890-example.apps.googleusercontent.com` | Google OAuth 클라이언트 ID입니다.                                                           |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-example`                                | Google OAuth 클라이언트 시크릿입니다. 반드시 시크릿으로 보관하세요.                         |
| `AUTH_SECRET`          | 긴 랜덤 문자열                                  | 인증 상태 서명에 사용할 시크릿입니다. 반드시 시크릿으로 보관하고 신중하게 교체하세요.       |
| `ORIGIN`               | `https://example.com`                           | 배포된 앱의 공개 origin입니다. 로컬 Docker 실행에서는 `http://localhost:3000`을 사용합니다. |
| `PORT`                 | `3000`                                          | Node 서버가 리슨할 포트입니다. 이미지 기본값은 `3000`입니다.                                |
| `HOST`                 | `0.0.0.0`                                       | Node 서버가 바인딩할 인터페이스입니다. 이미지 기본값은 `0.0.0.0`입니다.                     |

로컬에서 강한 `AUTH_SECRET`을 생성하려면 다음 명령을 사용할 수 있습니다.

```sh
openssl rand -base64 32
```

## 이미지 빌드

Dockerfile의 빌드 단계는 커밋된 npm lockfile을 우선 사용하고 `npm ci`와 `npm run build`를 순서대로 실행합니다. lockfile이 없는 오래된 체크아웃을 위해 컨테이너 내부에서 lockfile을 생성하는 fallback은 유지하지만, 재현 가능한 로컬/CI/운영 빌드를 위해서는 `package-lock.json`을 생성해 커밋하는 것을 권장합니다.

```sh
docker build -t ppong-nya:latest .
```

## 애플리케이션 컨테이너 실행

```sh
docker run --rm \
  -p 3000:3000 \
  -e ORIGIN=http://localhost:3000 \
  -e DATABASE_URL=mysql://ppong_nya:ppong_nya_password@host.docker.internal:3306/ppong_nya \
  -e GOOGLE_CLIENT_ID=replace-me \
  -e GOOGLE_CLIENT_SECRET=replace-me \
  -e AUTH_SECRET=$(openssl rand -base64 32) \
  ppong-nya:latest
```

런타임 이미지 내부에서는 SvelteKit Node 서버가 `node build` 명령으로 시작됩니다.

## 로컬 Docker Compose 예시

`docker-compose.yml`은 두 개의 서비스를 실행합니다.

- `app`: 이 저장소를 빌드하고 SvelteKit Node 서버를 <http://localhost:3000>에 노출합니다.
- `db`: MariaDB 11.4를 시작하고 로컬 확인을 위해 `localhost:3306`으로 노출합니다.

시크릿을 셸에 직접 입력하지 않으려면 로컬 `.env` 파일을 생성하세요.

```env
GOOGLE_CLIENT_ID=replace-me
GOOGLE_CLIENT_SECRET=replace-me
AUTH_SECRET=replace-me-with-a-long-random-string
```

그다음 다음 명령으로 실행합니다.

```sh
docker compose up --build
```

Compose 예시는 앱 컨테이너에 아래 데이터베이스 URL을 주입합니다.

```env
DATABASE_URL=mysql://ppong_nya:ppong_nya_password@db:3306/ppong_nya
```

Compose 네트워크 안에서는 서비스 이름인 `db`를 호스트명으로 사용합니다. 호스트 머신에서 직접 접속할 때만 `localhost`를 사용하세요.

## 운영 배포 참고 사항

- `ORIGIN`은 실제 외부 스킴과 호스트에 맞춰 설정하세요. 예: `https://ppong-nya.example.com`
- `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, 데이터베이스 비밀번호 등 민감한 값은 플랫폼의 시크릿 매니저에 저장하세요.
- 운영 데이터에는 영속 볼륨 또는 관리형 MariaDB 서비스를 사용하세요.
- TLS 종료는 플랫폼 로드 밸런서, 리버스 프록시, 또는 ingress controller에서 처리하세요.
- 데이터베이스 스키마가 변경되면 새 버전으로 트래픽을 전환하기 전에 `npm run db:migrate:deploy`를 실행하세요.
- `package.json`, `package-lock.json`, 또는 애플리케이션 소스가 변경될 때마다 이미지를 다시 빌드해 배포하세요.
- CI는 커밋된 `package-lock.json`을 기준으로 `npm ci`를 실행해 의존성 설치가 lockfile과 일치하는지 검증해야 합니다.

## 데이터베이스 및 Prisma 초기화

이 애플리케이션은 Prisma ORM을 사용하며, 외부 MariaDB에는 `DATABASE_URL` 환경 변수로 연결합니다. SvelteKit의 서버 전용 경계를 유지하기 위해 Prisma 클라이언트는 `$lib/server/db`에만 두었고, import는 `+page.server.ts`, `+layout.server.ts`, `+server.ts`, `hooks.server.ts`, 서버 actions, 또는 `$lib/server/**` 내부 모듈에서만 수행해야 합니다. 일반 `.svelte`, 클라이언트 라우트, 공용 유틸리티에서는 `$lib/server/db`를 import하지 마세요.

### 연결 문자열 형식

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"
```

예를 들어 관리형 MariaDB 또는 별도 VM의 MariaDB를 사용할 때는 아래처럼 외부 호스트를 지정합니다.

```env
DATABASE_URL="mysql://ppong_nya:strong-password@mariadb.example.com:3306/ppong_nya"
```

비밀번호에 `@`, `:`, `/`, `#`, `?` 같은 특수 문자가 있으면 URL 인코딩해야 합니다.

### 최초 설정 절차

1. MariaDB에 데이터베이스와 애플리케이션 계정을 생성합니다.

   ```sql
   CREATE DATABASE ppong_nya CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'ppong_nya'@'%' IDENTIFIED BY 'change-me';
   GRANT ALL PRIVILEGES ON ppong_nya.* TO 'ppong_nya'@'%';
   FLUSH PRIVILEGES;
   ```

2. `.env.example`을 참고해 로컬 `.env` 또는 배포 플랫폼 시크릿에 `DATABASE_URL`을 설정합니다.

3. 의존성을 설치합니다.

   ```sh
   npm install
   ```

   의존성 정의만 갱신하고 lockfile을 먼저 만들거나 갱신해야 한다면 저장소 루트에서 다음 명령을 사용할 수 있습니다. 생성된 `package-lock.json`은 커밋하세요.

   ```sh
   npm install --package-lock-only
   ```

4. Prisma Client를 생성합니다.

   ```sh
   npm run db:generate
   ```

5. 개발 환경에서 첫 마이그레이션을 생성하고 적용합니다.

   ```sh
   npm run db:migrate:dev -- --name init
   ```

6. 운영/스테이징 배포에서는 커밋된 `prisma/migrations`를 적용합니다.

   ```sh
   npm run db:migrate:deploy
   ```

마이그레이션 파일을 아직 만들지 않고 스키마를 임시로 동기화해야 하는 초기 프로토타입 환경에서는 `npm run db:push`를 사용할 수 있습니다. 단, 운영 환경에서는 변경 이력을 남기는 `db:migrate:dev`/`db:migrate:deploy` 흐름을 사용하세요.

### 스키마 개요

`prisma/schema.prisma`는 MariaDB용 `mysql` provider를 사용하며 다음 기본 테이블을 정의합니다.

- `User`: 사용자 프로필과 권한의 기준 테이블
- `Account`: OAuth/외부 로그인 계정 연결
- `Session`: 서버 세션 토큰과 만료 정보
- `GameRecord`: 대국 기록의 헤더와 모드/시간/메타데이터
- `Player`: 대국별 좌석, 닉네임, 점수, 순위
- `UserPreference`: 사용자별 key/value 설정
- `SavedItem`: 플레이어, 기록, 링크 등 저장 항목
- `AuditLog`: 주요 서버 동작 감사 로그

### 자주 쓰는 명령

| 명령                                      | 용도                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `npm run db:generate`                     | `prisma/schema.prisma`에서 Prisma Client를 생성합니다.                        |
| `npm run db:migrate:dev -- --name <name>` | 개발 DB에 변경을 적용하고 새 마이그레이션 파일을 생성합니다.                  |
| `npm run db:migrate:deploy`               | 운영/스테이징 DB에 커밋된 마이그레이션을 적용합니다.                          |
| `npm run db:push`                         | 마이그레이션 파일 없이 현재 스키마를 DB에 반영합니다. 운영 사용은 지양하세요. |
| `npm run db:studio`                       | Prisma Studio로 데이터를 확인합니다.                                          |
