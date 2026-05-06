export type UserPreferenceItem = {
  id: string;
  key: string;
  value: unknown;
  updatedAt: string;
};

export type FavoritePlayerItem = {
  id: string;
  playerId: string;
  nickname: string;
  displayName?: string | null;
  server?: string | null;
  memo?: string | null;
  updatedAt: string;
};

export type GameRecordItem = {
  id: string;
  mode: "SANMA" | "YONMA";
  tableName?: string | null;
  startedAt: string;
  rounds?: number | null;
  players: Array<{
    id: string;
    nickname: string;
    score: number;
    placement: number;
  }>;
};

export type GameNoteItem = {
  id: string;
  title: string;
  body: string;
  gameRecordId?: string | null;
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
    async listPreferences() {
      const data = await requestApi<{ preferences: UserPreferenceItem[] }>(
        "/api/preferences",
      );
      return data.preferences;
    },
    async savePreference(key: string, value: unknown) {
      const data = await requestApi<{ preference: UserPreferenceItem }>(
        "/api/preferences",
        {
          method: "POST",
          body: JSON.stringify({ key, value }),
        },
      );
      return data.preference;
    },
    async deletePreference(id: string) {
      return requestApi<{ ok: boolean }>("/api/preferences", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
    },
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
    async listGameRecords() {
      const data = await requestApi<{ records: GameRecordItem[] }>(
        "/api/game-records",
      );
      return data.records;
    },
    async saveGameRecord(input: {
      mode: "SANMA" | "YONMA";
      tableName?: string;
      startedAt?: string;
      rounds?: number;
    }) {
      const data = await requestApi<{ record: GameRecordItem }>(
        "/api/game-records",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      );
      return data.record;
    },
    async deleteGameRecord(id: string) {
      return requestApi<{ ok: boolean }>("/api/game-records", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
    },
    async listNotes() {
      const data = await requestApi<{ notes: GameNoteItem[] }>("/api/notes");
      return data.notes;
    },
    async saveNote(input: {
      title: string;
      body: string;
      gameRecordId?: string;
    }) {
      const data = await requestApi<{ note: GameNoteItem }>("/api/notes", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return data.note;
    },
    async deleteNote(id: string) {
      return requestApi<{ ok: boolean }>("/api/notes", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
    },
  };
}
