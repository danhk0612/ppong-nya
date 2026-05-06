# 배포 가이드

이 프로젝트는 `@sveltejs/adapter-node`를 사용해 SvelteKit Node 서버로 빌드됩니다. Docker 이미지는 빌드 단계에서 의존성 설치와 애플리케이션 빌드를 수행하고, 런타임 단계에는 빌드 산출물과 production dependencies만 포함합니다.

## 사전 준비

- 로컬 개발용 Node.js 20 이상
- npm 10 이상
- 컨테이너 실행용 Docker 및 Docker Compose
- 영속 데이터가 필요한 환경에서 사용할 MariaDB 호환 데이터베이스

## 런타임 환경 변수

아래 값은 호스팅 플랫폼, `docker run -e`, Docker Compose `environment`, 또는 시크릿 매니저를 통해 주입하세요.

| 변수 | 예시 | 설명 |
| --- | --- | --- |
| `DATABASE_URL` | `mysql://ppong_nya:password@db:3306/ppong_nya` | 애플리케이션에서 사용할 MariaDB 연결 문자열입니다. |
| `GOOGLE_CLIENT_ID` | `1234567890-example.apps.googleusercontent.com` | Google OAuth 클라이언트 ID입니다. |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-example` | Google OAuth 클라이언트 시크릿입니다. 반드시 시크릿으로 보관하세요. |
| `AUTH_SECRET` | 긴 랜덤 문자열 | 인증 상태 서명에 사용할 시크릿입니다. 반드시 시크릿으로 보관하고 신중하게 교체하세요. |
| `ORIGIN` | `https://example.com` | 배포된 앱의 공개 origin입니다. 로컬 Docker 실행에서는 `http://localhost:3000`을 사용합니다. |
| `PORT` | `3000` | Node 서버가 리슨할 포트입니다. 이미지 기본값은 `3000`입니다. |
| `HOST` | `0.0.0.0` | Node 서버가 바인딩할 인터페이스입니다. 이미지 기본값은 `0.0.0.0`입니다. |

로컬에서 강한 `AUTH_SECRET`을 생성하려면 다음 명령을 사용할 수 있습니다.

```sh
openssl rand -base64 32
```

## 이미지 빌드

Dockerfile의 빌드 단계는 npm lockfile이 있으면 그대로 사용하고, 현재 저장소처럼 lockfile이 없으면 컨테이너 내부에서 lockfile을 생성한 뒤 `npm ci`와 `npm run build`를 순서대로 실행합니다. 재현 가능한 운영 빌드를 위해서는 생성된 npm lockfile을 별도로 커밋하는 것을 권장합니다.

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
- 추후 데이터베이스 마이그레이션 또는 시드 스크립트가 추가되면 새 버전으로 트래픽을 전환하기 전에 실행하세요.
- `package.json`, npm lockfile, 또는 애플리케이션 소스가 변경될 때마다 이미지를 다시 빌드해 배포하세요.
