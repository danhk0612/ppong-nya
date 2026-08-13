# Oracle Cloud ARM 운영 배포

Oracle Cloud Ampere(`linux/arm64`) VM에서 공개 GHCR 이미지, 전용 MariaDB, 기존 Nginx Proxy Manager를 사용합니다. MariaDB와 앱 포트는 호스트에 공개하지 않습니다.

## 1. Nginx Proxy Manager 네트워크 확인

```bash
docker inspect nginx-proxy-manager \
  --format '{{range $name, $config := .NetworkSettings.Networks}}{{$name}}{{"\n"}}{{end}}'
```

출력된 네트워크 이름을 `.env`의 `PROXY_NETWORK`에 사용합니다.

## 2. 운영 파일 준비

```bash
sudo mkdir -p /opt/ppong-nya/source/data/mariadb
sudo chown -R "$(id -u):$(id -g)" /opt/ppong-nya
git clone https://github.com/danhk0612/ppong-nya.git /opt/ppong-nya/source
cd /opt/ppong-nya/source
cp .env.oracle.example .env
chmod 600 .env
```

`.env`에서 다음 값을 교체합니다.

```bash
openssl rand -hex 32
openssl rand -hex 32
openssl rand -base64 32
```

- 첫 번째 16진수: `MARIADB_PASSWORD`
- 두 번째 16진수: `MARIADB_ROOT_PASSWORD`
- Base64: `AUTH_SECRET`
- 별도의 초기 관리자 계정: `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD`

Google OAuth를 사용하지 않으면 두 Google 환경 변수는 빈 값으로 둡니다.

## 3. 실행

```bash
docker compose --env-file .env -f compose.production.yml -f compose.oracle.yml config
docker compose --env-file .env -f compose.production.yml -f compose.oracle.yml pull
docker compose --env-file .env -f compose.production.yml -f compose.oracle.yml up -d
docker compose --env-file .env -f compose.production.yml -f compose.oracle.yml ps
docker compose --env-file .env -f compose.production.yml -f compose.oracle.yml logs --tail=100 migrate app db
```

정상 상태는 `db` healthy, `migrate` 종료 코드 0, `app` healthy입니다.

## 4. Nginx Proxy Manager

Proxy Host를 다음과 같이 추가합니다.

| 항목                  | 값                     |
| --------------------- | ---------------------- |
| Domain Names          | `ppong-nya.mydepot.kr` |
| Scheme                | `http`                 |
| Forward Hostname / IP | `ppong-nya-app`        |
| Forward Port          | `3000`                 |
| Websockets Support    | 활성화                 |

SSL 탭에서 Let's Encrypt 인증서를 요청하고 `Force SSL`과 `HTTP/2 Support`를 활성화합니다. Oracle Cloud NSG/보안 목록과 Ubuntu 방화벽에는 TCP 80, 443만 외부에 공개합니다. 3000과 3306은 개방하지 않습니다.

Google OAuth 콜백은 `https://ppong-nya.mydepot.kr/auth/callback/google`입니다.
