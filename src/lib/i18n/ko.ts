export const ko = {
  app: {
    name: "퐁냐",
    title: "퐁냐",
    description:
      "퐁냐는 작혼 전적, 랭킹, 통계를 한눈에 살펴보는 한국어 서비스입니다.",
    navigationLabel: "기본 내비게이션",
    logoKana: "にゃ",
  },
  nav: {
    home: "홈",
    ranking: "랭킹",
    records: "전적",
    tools: "도구",
    account: "계정",
    login: "로그인",
    logout: "로그아웃",
    userImageAlt: "로그인 사용자 프로필 이미지",
  },
  home: {
    eyebrow: "SvelteKit으로 새롭게 시작하는 퐁냐",
    title: "마작 기록을 더 가볍고 빠르게 만나는 홈 화면",
    description:
      "퐁냐는 초기 MVP에서 한국어 단일 UI를 기본으로 제공하고, 향후 다국어 확장을 위해 한국어 리소스 구조를 유지합니다.",
    loginCta: "로그인하고 시작하기",
    exploreCta: "기능 둘러보기",
    dashboardEyebrow: "오늘의 퐁냐",
    dashboardTitle: "홈 대시보드",
    betaBadge: "베타",
    highlights: [
      {
        id: "ranking",
        label: "실시간 랭킹",
        description:
          "단위전과 대회 기록을 빠르게 탐색할 수 있도록 준비 중입니다.",
      },
      {
        id: "player-search",
        label: "플레이어 검색",
        description:
          "닉네임과 플레이어 ID로 작혼 플레이어를 찾는 검색 화면을 한국어로 제공합니다.",
      },
      {
        id: "records",
        label: "대국 기록",
        description:
          "플레이어별 경기 흐름과 최근 대국 기록을 퐁냐에서 이어갑니다.",
      },
      {
        id: "statistics",
        label: "통계",
        description:
          "순위, 화료율, 방총률 등 주요 지표를 ko-KR 숫자 포맷으로 보여줄 예정입니다.",
      },
      {
        id: "settings",
        label: "설정",
        description:
          "계정별 표시 방식과 기본 언어를 한국어 중심으로 관리합니다.",
      },
      {
        id: "tools",
        label: "분석 도구",
        description:
          "필터, 통계, 하이라이트 기능을 SvelteKit 기반으로 새롭게 구성합니다.",
      },
    ],
  },
  login: {
    title: "로그인 | 퐁냐",
    description: "Google OAuth로 퐁냐에 로그인합니다.",
    eyebrow: "Google OAuth 로그인",
    heading: "퐁냐 계정으로 시작하기",
    body: "Google 계정으로 로그인하면 MariaDB에 사용자와 OAuth 계정 정보가 저장되고, 전적 저장 및 계정 관리 기능을 사용할 수 있습니다.",
    googleCta: "Google로 로그인",
    googleCtaLabel: "Google 계정으로 퐁냐에 로그인",
    envNotice:
      "OAuth 클라이언트에는 GOOGLE_CLIENT_ID와 GOOGLE_CLIENT_SECRET 환경 변수를 사용합니다.",
  },
  account: {
    title: "계정 관리 | 퐁냐",
    description: "퐁냐 로그인 계정과 개인 데이터를 관리합니다.",
    providerLabel: "Google 로그인 계정",
    unnamedUser: "이름 없는 사용자",
    userId: "사용자 ID",
    role: "권한",
    sessionTitle: "세션 정보",
    sessionExpires: "Auth.js 세션 만료",
    databaseSessionId: "DB 세션 ID",
    databaseSessionExpires: "DB 세션 만료",
    databaseSessionMissing:
      "현재 요청의 세션 토큰과 일치하는 sessions 레코드를 찾지 못했습니다.",
    accountTitle: "연결된 OAuth 계정",
    accountProvider: "제공자",
    accountType: "유형",
    accountProviderId: "제공자 계정 ID",
    accountScope: "권한 범위",
    accountConnectedAt: "연결 시각",
    noAccount: "연결된 OAuth 계정이 없습니다.",
    scopeTitle: "저장 데이터 범위",
    scopeDescription:
      "퐁냐는 사용자 설정, 즐겨찾기 플레이어, 대국 기록, 대국 메모, 검색 기록, 통계 캐시를 사용자 계정에 연결해 저장합니다. 이 화면은 우선 네 가지 CRUD API를 호출해 기본 데이터를 관리합니다.",
    loading: "개인 데이터를 불러오는 중입니다...",
    unknownDataError: "데이터를 불러오지 못했습니다.",
    unknownRequestError: "요청을 처리하지 못했습니다.",
    messages: {
      preferenceSaved: "사용자 설정을 저장했습니다.",
      favoriteSaved: "즐겨찾기 플레이어를 저장했습니다.",
      recordSaved: "대국 기록을 저장했습니다.",
      noteSaved: "대국 메모를 저장했습니다.",
      preferenceDeleted: "설정을 삭제했습니다.",
      favoriteDeleted: "즐겨찾기를 삭제했습니다.",
      recordDeleted: "대국 기록을 삭제했습니다.",
      noteDeleted: "메모를 삭제했습니다.",
    },
    preferences: {
      title: "사용자 설정",
      keyPlaceholder: "키",
      valuePlaceholder: "값",
      save: "저장",
      delete: "설정 삭제",
      empty: "저장된 설정이 없습니다.",
    },
    favorites: {
      title: "즐겨찾기 플레이어",
      playerIdPlaceholder: "플레이어 ID",
      nicknamePlaceholder: "닉네임",
      serverPlaceholder: "서버",
      memoPlaceholder: "메모",
      save: "저장",
      delete: "즐겨찾기 삭제",
      empty: "즐겨찾기 플레이어가 없습니다.",
    },
    records: {
      title: "대국 기록",
      yonma: "4인전",
      sanma: "3인전",
      tablePlaceholder: "탁 이름",
      roundsPlaceholder: "국 수",
      add: "추가",
      delete: "대국 기록 삭제",
      untitled: "이름 없는 대국",
      empty: "대국 기록이 없습니다.",
      noRounds: "?",
    },
    notes: {
      title: "대국 메모",
      titlePlaceholder: "제목",
      noRecord: "대국 기록 연결 없음",
      bodyPlaceholder: "복기 메모",
      save: "저장",
      delete: "메모 삭제",
      empty: "대국 메모가 없습니다.",
    },
  },
  error: {
    title: "오류가 발생했습니다 | 퐁냐",
    heading: "오류가 발생했습니다",
    unknownStatus: "알 수 없는 오류",
    fallbackMessage:
      "요청한 화면을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    homeCta: "홈으로 돌아가기",
  },
} as const;

export type KoreanMessages = typeof ko;
