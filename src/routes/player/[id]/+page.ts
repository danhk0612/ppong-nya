import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = ({ params }) => {
  if (!/^\d+$/.test(params.id)) {
    error(404, "올바르지 않은 플레이어 ID입니다.");
  }

  return { playerId: params.id };
};
