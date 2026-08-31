import { FOUR_PLAYER_RANKED_MODES } from "./modes.mjs";

const expected = [2, 3, 5, 6, 8, 9, 11, 12, 15, 16];
const actual = FOUR_PLAYER_RANKED_MODES.map((item) => item.modeId);
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`unexpected 4-player mode list: ${JSON.stringify(actual)}`);
}
for (const item of FOUR_PLAYER_RANKED_MODES) {
  if (item.filterId !== 200 + item.modeId) throw new Error(`invalid filter mapping for mode ${item.modeId}`);
}
if (new Set(FOUR_PLAYER_RANKED_MODES.map((item) => item.filterId)).size !== FOUR_PLAYER_RANKED_MODES.length) {
  throw new Error("duplicate collector filter id");
}
console.log(`collector mode smoke ok: ${FOUR_PLAYER_RANKED_MODES.map((item) => `${item.room}/${item.round}=${item.filterId}`).join(", ")}`);
