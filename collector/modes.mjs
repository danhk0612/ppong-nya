export const FOUR_PLAYER_RANKED_MODES = [
  { room: "동탁", round: "동풍전", modeId: 2, filterId: 202 },
  { room: "동탁", round: "남풍전", modeId: 3, filterId: 203 },
  { room: "은탁", round: "동풍전", modeId: 5, filterId: 205 },
  { room: "은탁", round: "남풍전", modeId: 6, filterId: 206 },
  { room: "금탁", round: "동풍전", modeId: 8, filterId: 208 },
  { room: "금탁", round: "남풍전", modeId: 9, filterId: 209 },
  { room: "옥탁", round: "동풍전", modeId: 11, filterId: 211 },
  { room: "옥탁", round: "남풍전", modeId: 12, filterId: 212 },
  { room: "왕좌탁", round: "동풍전", modeId: 15, filterId: 215 },
  { room: "왕좌탁", round: "남풍전", modeId: 16, filterId: 216 },
];

export const MODE_IDS = new Set(FOUR_PLAYER_RANKED_MODES.map((item) => item.modeId));

export function getModeByFilterId(filterId) {
  return FOUR_PLAYER_RANKED_MODES.find((item) => item.filterId === filterId) ?? null;
}

export function getModeByModeId(modeId) {
  return FOUR_PLAYER_RANKED_MODES.find((item) => item.modeId === modeId) ?? null;
}
