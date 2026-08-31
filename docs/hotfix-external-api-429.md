# External API 429 hotfix

## 증상

플레이어 검색 또는 플레이어 페이지 진입 시 upstream external API가 HTTP 429를 반환하면 `External API request failed with status 429.` 오류가 사용자에게 그대로 노출됨.

## 원인

기존 미러 전환 로직은 네트워크 예외가 발생한 경우에만 다른 amae-koromo 미러를 탐색했다. HTTP 429와 5xx는 정상 `Response`로 간주되어 첫 미러의 오류가 그대로 반환되었다.

## 수정

- HTTP 408/425/429/5xx를 재시도 가능한 upstream 상태로 처리
- 선택된 미러부터 시작해 다른 미러를 순차 시도
- 정상 또는 비재시도 상태 응답을 반환한 미러를 다음 요청의 우선 미러로 유지
- 모든 미러가 실패하거나 재시도 가능한 오류만 반환할 경우, 기존 ExternalApiCache가 있으면 만료 캐시를 stale fallback으로 사용
- stale 응답에는 `x-ppong-nya-cache: stale` 헤더와 Warning 헤더 추가

CAP 프록시와 기존 외부 API JSON 압축/헤더 정리 흐름은 변경하지 않는다.
