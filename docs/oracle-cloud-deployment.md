# Oracle Cloud ARM 운영 배포

Oracle Cloud Ampere(`linux/arm64`) VM에서 공개 GHCR 이미지, Compose의 MariaDB 11.4, 기존 Nginx Proxy Manager를 사용합니다. 앱과 Nginx Proxy Manager는 `proxy` 네트워크로 연결하며 MariaDB 포트는 외부에 공개하지 않습니다.

## 1. Nginx Proxy Manager 네트워크 확인

```bash
docker inspect nginx-proxy-manager \
  --format '{{range $name, $config := .NetworkSettings.Networks}}{{$name}}{{"\n"}}{{end}}'
```

출력된 네트워크 이름을 `.env`의 `PROXY_NETWORK`에 사용합니다. 현재 운영 기본값은 `proxy`입니다.

## 2. 운영 파일 준비

최초 설치:

```bash
sudo mkdir -p /opt/ppong-nya/source/data/mariadb
sudo chown -R "$(id -u):$(id -g)" /opt/ppong-nya
git clone https://github.com/danhk0612/ppong-nya.git /opt/ppong-nya/source
cd /opt/ppong-nya/source
cp .env.oracle.example .env
chmod 600 .env
```

`.env`에서 MariaDB 비밀번호를 교체합니다.

```bash
openssl rand -hex 32
openssl rand -hex 32
```

- 첫 번째 값: `MARIADB_PASSWORD`
- 두 번째 값: `MARIADB_ROOT_PASSWORD`

필요하면 공용 플레이어 캐시 보관값도 조정합니다.

```env
PLAYER_CACHE_RETENTION_DAYS=90
PLAYER_CACHE_MAX_RECORDS=2000
```

회원, 로그인, OAuth, 초기 관리자 관련 환경 변수는 사용하지 않습니다.

## 3. 최초 실행 또는 운영 갱신

```bash
cd /opt/ppong-nya/source
git pull --ff-only
docker compose --env-file .env -f compose.production.yml -f compose.oracle.yml config
docker compose --env-file .env -f compose.production.yml -f compose.oracle.yml pull
docker compose --env-file .env -f compose.production.yml -f compose.oracle.yml up -d
docker compose --env-file .env -f compose.production.yml -f compose.oracle.yml ps
docker compose --env-file .env -f compose.production.yml -f compose.oracle.yml logs --tail=100 migrate app db
```

`migrate` 서비스는 새 앱이 시작되기 전에 `prisma migrate deploy`를 실행합니다. 정상 상태는 다음과 같습니다.

- `db`: healthy
- `migrate`: 종료 코드 0
- `app`: healthy

공용 플레이어 캐시 개편 배포 시 기존 즐겨찾기 플레이어와 연결 대국은 마이그레이션 과정에서 공용 캐시로 복사됩니다.

## 4. Nginx Proxy Manager

Proxy Host 설정:

| 항목 | 값 |
| --- | --- |
| Domain Names | `ppong-nya.mydepot.kr` |
| Scheme | `http` |
| Forward Hostname / IP | `ppong-nya-app` |
| Forward Port | `3000` |
| Websockets Support | 활성화 |

SSL 탭에서 Let's Encrypt 인증서를 사용하고 `Force SSL`과 `HTTP/2 Support`를 활성화합니다. Oracle Cloud NSG/보안 목록과 Ubuntu 방화벽에는 TCP 80, 443만 외부에 공개합니다. 3000과 3306은 외부에 개방하지 않습니다.

## 5. 배포 후 확인

운영 주소에서 다음을 확인합니다.

1. 홈과 플레이어 검색 화면이 로그인 없이 표시되는지 확인합니다.
2. 닉네임 검색과 숫자 ID 직접 접근을 각각 확인합니다.
3. 플레이어 페이지에서 최근 30일 기본 조회가 동작하는지 확인합니다.
4. 기간과 탁 종류를 변경했을 때 대국 목록과 통계가 함께 변경되는지 확인합니다.
5. 마지막 업데이트 시각과 수동 새로고침을 확인합니다.
6. 같은 플레이어를 다시 열었을 때 저장 데이터가 재사용되는지 확인합니다.
7. `migrate` 로그에 실패한 Prisma 마이그레이션이 없는지 확인합니다.
8. 기존 CAP 프록시와 외부 API 요청이 정상인지 확인합니다.
