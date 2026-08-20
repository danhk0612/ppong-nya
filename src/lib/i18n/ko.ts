export const ko = {
  app: {
    name: "퐁냐",
    title: "퐁냐",
    description:
      "작혼 4인전 플레이어를 검색하고 즐겨찾기 전적과 통계를 확인하세요.",
    navigationLabel: "기본 내비게이션",
    logoKana: "にゃ",
  },
  nav: {
    home: "홈",
    favorites: "즐겨찾기",
    account: "계정",
    login: "로그인",
    logout: "로그아웃",
    userImageAlt: "로그인 사용자 프로필 이미지",
  },
  home: {
    eyebrow: "작혼 4인전 전적",
    title: "찾고, 즐겨찾고, 전적을 확인하세요",
    description:
      "닉네임으로 플레이어를 검색하고 자주 보는 플레이어의 통계와 최근 전적을 한곳에서 확인할 수 있습니다.",
    loginCta: "로그인",
  },
  login: {
    title: "로그인 | 퐁냐",
    description: "이메일 아이디와 비밀번호로 퐁냐에 로그인합니다.",
    eyebrow: "이메일 로그인",
    heading: "퐁냐 계정으로 시작하기",
    body: "로그인하면 즐겨찾기 플레이어의 전적과 통계를 편하게 확인할 수 있습니다.",
  },
  account: {
    title: "계정 관리 | 퐁냐",
    description: "퐁냐 로그인 계정과 개인 데이터를 관리합니다.",
    providerLabel: "내 계정",
    unnamedUser: "이름 없는 사용자",
    loading: "개인 데이터를 불러오는 중입니다...",
    unknownDataError: "데이터를 불러오지 못했습니다.",
    unknownRequestError: "요청을 처리하지 못했습니다.",
    messages: {
      favoriteSaved: "즐겨찾기 플레이어를 저장했습니다.",
      favoriteDeleted: "즐겨찾기를 삭제했습니다.",
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
