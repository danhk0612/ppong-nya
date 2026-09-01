export enum GameMode {
  铜 = 3,
  银 = 6,
  金 = 9,
  玉 = 12,
  王座 = 16,
  铜东 = 2,
  银东 = 5,
  金东 = 8,
  玉东 = 11,
  王东 = 15,
  三金 = 22,
  三玉 = 24,
  三王座 = 26,
  三金东 = 21,
  三玉东 = 23,
  三王东 = 25,
}

const KOREAN_YONMA_MODE_LABELS: Partial<Record<GameMode, string>> = {
  [GameMode.王座]: "왕좌탁 남풍전",
  [GameMode.玉]: "옥탁 남풍전",
  [GameMode.金]: "금탁 남풍전",
  [GameMode.银]: "은탁 남풍전",
  [GameMode.铜]: "동탁 남풍전",
  [GameMode.王东]: "왕좌탁 동풍전",
  [GameMode.玉东]: "옥탁 동풍전",
  [GameMode.金东]: "금탁 동풍전",
  [GameMode.银东]: "은탁 동풍전",
  [GameMode.铜东]: "동탁 동풍전",
};

export function modeLabel(mode: GameMode) {
  return KOREAN_YONMA_MODE_LABELS[mode] ?? "지원하지 않는 대국";
}
export function parseCombinedMode(modeString?: string): GameMode[] {
  return (modeString || "")
    .split(".")
    .map((x) => parseInt(x.trim(), 10) as GameMode)
    .map((x) => (GameMode[x] ? x : (0 as GameMode)))
    .filter((x) => x);
}
