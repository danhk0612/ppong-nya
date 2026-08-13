# Synology NAS 운영 배포

운영 구성은 공개 GHCR 이미지, 전용 MariaDB 컨테이너, 일회성 Prisma 마이그레이션 컨테이너로 구성됩니다. DB 포트는 NAS 외부에 게시하지 않으며 앱만 `127.0.0.1:3000`에 바인딩합니다.

## 1. 사전 조건

- Synology Container Manager와 Git이 설치되어 있어야 합니다.
- `ppong-nya.mydepot.kr`이 NAS의 외부 접속 주소를 가리켜야 합니다.
- DSM에 `ppong-nya.mydepot.kr` 인증서가 준비되어 있어야 합니다.
- `ghcr.io/danhk0612/ppong-nya:latest` 패키지가 Public으로 전환되어 있어야 합니다.

## 2. 운영 파일 준비

SSH에서 다음 경로에 저장소와 DB 데이터 디렉터리를 준비합니다.

```bash
sudo mkdir -p /volume1/docker/ppong-nya
sudo chown "$(id -u):$(id -g)" /volume1/docker/ppong-nya
git clone https://github.com/danhk0612/ppong-nya.git /volume1/docker/ppong-nya/source
cd /volume1/docker/ppong-nya/source
mkdir -p data/mariadb
cp .env.nas.example .env
chmod 600 .env
```

`.env`에서 다음 값은 반드시 교체합니다.

```bash
openssl rand -hex 32
openssl rand -hex 32
openssl rand -base64 32
```

- 첫 번째 16진수 값: `MARIADB_PASSWORD`
- 두 번째 16진수 값: `MARIADB_ROOT_PASSWORD`
- Base64 값: `AUTH_SECRET`
- 별도로 만든 초기 관리자 비밀번호: `DEFAULT_ADMIN_PASSWORD`

DB 암호는 Compose가 Prisma 접속 URL을 조립하므로 URL 인코딩이 필요 없는 16진수 값을 사용합니다. Google OAuth를 당장 사용하지 않으면 두 Google 환경 변수는 빈 값으로 둡니다.

## 3. 컨테이너 시작

```bash
docker compose --env-file .env -f compose.production.yml config
docker compose --env-file .env -f compose.production.yml pull
docker compose --env-file .env -f compose.production.yml up -d
docker compose --env-file .env -f compose.production.yml ps
docker compose --env-file .env -f compose.production.yml logs --tail=100 migrate app db
```

정상 상태는 다음과 같습니다.

- `db`: `healthy`
- `migrate`: 종료 코드 `0`
- `app`: `healthy`
- NAS 내부의 `http://127.0.0.1:3000`: HTTP 응답 반환

## 4. DSM 역방향 프록시

DSM 제어판의 로그인 포털 → 고급 → 역방향 프록시에서 다음 규칙을 만듭니다.

| 항목          | 값                     |
| ------------- | ---------------------- |
| 원본 프로토콜 | HTTPS                  |
| 원본 호스트   | `ppong-nya.mydepot.kr` |
| 원본 포트     | `443`                  |
| 대상 프로토콜 | HTTP                   |
| 대상 호스트   | `127.0.0.1`            |
| 대상 포트     | `3000`                 |

DSM 인증서 설정에서 이 호스트에 `ppong-nya.mydepot.kr` 인증서를 할당합니다. 공유기와 NAS 방화벽은 외부 HTTPS 포트만 허용하고 앱 포트 `3000`과 MariaDB 포트 `3306`은 외부에 열지 않습니다.

Google OAuth를 사용할 때 승인된 리디렉션 URI는 다음 값입니다.

```text
https://ppong-nya.mydepot.kr/auth/callback/google
```

## 5. 최초 로그인과 업데이트

`.env`의 `DEFAULT_ADMIN_EMAIL`과 `DEFAULT_ADMIN_PASSWORD`로 로그인한 뒤 `/account`에서 이메일과 비밀번호를 즉시 변경합니다.

새 이미지가 게시된 뒤에는 다음 명령으로 업데이트합니다.

```bash
cd /volume1/docker/ppong-nya/source
git pull --ff-only
docker compose --env-file .env -f compose.production.yml pull
docker compose --env-file .env -f compose.production.yml up -d
```

`data/mariadb`는 컨테이너 삭제와 무관하게 유지되는 운영 데이터입니다. 이 디렉터리를 삭제하거나 빈 경로로 바꾸기 전에 DB 백업과 복구 가능 여부를 먼저 확인해야 합니다.
