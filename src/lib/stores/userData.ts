export type FavoritePlayerItem = {
  id: string;
  playerId: string;
  nickname: string;
  currentLevel?: {
    id: number;
    score: number;
    delta: number;
  } | null;
  lastRefreshedAt?: string | null;
  updatedAt: string;
};

async function requestApi<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as T;
}

export function createUserDataApi() {
  return {
    async listFavorites() {
      const data = await requestApi<{ favorites: FavoritePlayerItem[] }>(
        "/api/favorites",
      );
      return data.favorites;
    },
    async saveFavorite(input: {
      playerId: string;
      nickname: string;
      server?: string;
      memo?: string;
    }) {
      const data = await requestApi<{ favorite: FavoritePlayerItem }>(
        "/api/favorites",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      );
      return data.favorite;
    },
    async deleteFavorite(id: string) {
      return requestApi<{ ok: boolean }>("/api/favorites", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
    },
  };
}
