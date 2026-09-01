export enum GameMode {
  王座 = 16,
  玉 = 12,
  金 = 9,
  王东 = 15,
  玉东 = 11,
  金东 = 8,
  三金 = 22,
  三玉 = 24,
  三王座 = 26,
  三金东 = 21,
  三玉东 = 23,
  三王东 = 25,
}

const KOREAN_YONMA_MODE_LABELS: Record<number, string> = {
  16: "왕좌탁 남풍전",
  15: "왕좌탁 동풍전",
  12: "옥탁 남풍전",
  11: "옥탁 동풍전",
  9: "금탁 남풍전",
  8: "금탁 동풍전",
  6: "은탁 남풍전",
  5: "은탁 동풍전",
  3: "동탁 남풍전",
  2: "동탁 동풍전",
};

export function modeLabel(mode: GameMode | number) {
  return KOREAN_YONMA_MODE_LABELS[mode] ?? "지원하지 않는 대국";
}
export function parseCombinedMode(modeString?: string): GameMode[] {
  return (modeString || "")
    .split(".")
    .map((x) => parseInt(x.trim(), 10) as GameMode)
    .map((x) => (GameMode[x] ? x : (0 as GameMode)))
    .filter((x) => x);
}
