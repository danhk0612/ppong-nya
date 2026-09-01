import { randomUUID } from "node:crypto";
import { getModeByModeId } from "./modes.mjs";

function asDate(unixSeconds) {
  return unixSeconds ? new Date(Number(unixSeconds) * 1000) : null;
}

function playerMetadata(account, result) {
  return JSON.stringify({
    levelId: account?.level?.id ?? null,
    levelScore: account?.level?.score ?? null,
    level3Id: account?.level3?.id ?? null,
    level3Score: account?.level3?.score ?? null,
    avatarId: account?.avatar_id ?? null,
    title: account?.title ?? null,
    totalPoint: result?.total_point ?? null,
    partPoint2: result?.part_point_2 ?? null,
    gradingScore: result?.grading_score ?? null,
  });
}

export async function materializeCollectedGame(pool, head) {
  const uuid = String(head?.uuid || "");
  const modeId = Number(head?.config?.meta?.mode_id || 0);
  const accounts = Array.isArray(head?.accounts) ? head.accounts : [];
  const results = Array.isArray(head?.result?.players) ? head.result.players : [];

  if (!uuid) throw new Error("materialize: missing game uuid");
  if (accounts.length !== 4 || results.length !== 4) {
    throw new Error(`materialize: expected 4 accounts/results, got ${accounts.length}/${results.length}`);
  }

  const mode = getModeByModeId(modeId);
  if (!mode) throw new Error(`materialize: unsupported mode ${modeId}`);

  const resultBySeat = new Map(results.map((item, index) => [Number(item.seat), { ...item, placement: index + 1 }]));
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.execute(
      `SELECT id FROM game_records WHERE source='majsoul-native' AND uuid=? LIMIT 1`,
      [uuid],
    );
    if (existingRows.length) {
      await connection.commit();
      return { gameRecordId: existingRows[0].id, players: 4, existing: true };
    }

    const gameRecordId = randomUUID();
    const startedAt = asDate(head.start_time);
    if (!startedAt) throw new Error(`materialize: missing start_time for ${uuid}`);

    await connection.execute(
      `INSERT INTO game_records
        (id, userId, externalId, source, sourceRecordId, uuid, mode, externalModeId,
         startedAt, endedAt, tableName, rounds, metadata, rawPayload, createdAt, updatedAt)
       VALUES (?, NULL, NULL, 'majsoul-native', ?, ?, 'YONMA', ?, ?, ?, ?, NULL, ?, ?, NOW(3), NOW(3))`,
      [
        gameRecordId,
        uuid,
        uuid,
        modeId,
        startedAt,
        asDate(head.end_time),
        `${mode.room} ${mode.round}`,
        JSON.stringify({
          category: head?.config?.category ?? null,
          standardRule: head?.standard_rule ?? null,
          round: mode.round,
          room: mode.room,
          source: "native-collector",
        }),
        JSON.stringify(head),
      ],
    );

    for (const account of accounts) {
      const seat = Number(account.seat);
      const result = resultBySeat.get(seat);
      if (!result) throw new Error(`materialize: missing result for seat ${seat}`);

      const accountId = String(account.account_id ?? "");
      const nickname = String(account.nickname ?? "");
      if (!accountId || !nickname) throw new Error(`materialize: invalid account at seat ${seat}`);

      await connection.execute(
        `INSERT INTO players
          (id, gameRecordId, seat, accountId, nickname, rankLabel, score, placement,
           ratingDelta, metadata, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [
          randomUUID(),
          gameRecordId,
          seat,
          accountId,
          nickname,
          Number(result.part_point_1 ?? 0),
          Number(result.placement),
          result.grading_score == null ? null : Number(result.grading_score),
          playerMetadata(account, result),
        ],
      );

      const levelId = account?.level?.id == null ? null : Number(account.level.id);
      const latestTimestamp = head.start_time == null ? null : Number(head.start_time);
      const [cachedRows] = await connection.execute(
        `SELECT id FROM cached_players WHERE player_id=? LIMIT 1`,
        [accountId],
      );

      let cachedPlayerId;
      if (cachedRows.length) {
        cachedPlayerId = cachedRows[0].id;
        await connection.execute(
          `UPDATE cached_players
              SET nickname=?,
                  level=COALESCE(?, level),
                  max_level=CASE
                    WHEN ? IS NULL THEN max_level
                    WHEN max_level IS NULL OR ? > max_level THEN ?
                    ELSE max_level
                  END,
                  latest_timestamp=CASE
                    WHEN ? IS NULL THEN latest_timestamp
                    WHEN latest_timestamp IS NULL OR ? > latest_timestamp THEN ?
                    ELSE latest_timestamp
                  END,
                  last_updated_at=NOW(3), updated_at=NOW(3)
            WHERE id=?`,
          [nickname, levelId, levelId, levelId, levelId, latestTimestamp, latestTimestamp, latestTimestamp, cachedPlayerId],
        );
      } else {
        cachedPlayerId = randomUUID();
        await connection.execute(
          `INSERT INTO cached_players
            (id, player_id, nickname, level, max_level, latest_timestamp,
             last_accessed_at, last_updated_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3), NOW(3))`,
          [cachedPlayerId, accountId, nickname, levelId, levelId, latestTimestamp],
        );
      }

      await connection.execute(
        `INSERT IGNORE INTO cached_player_game_records
          (cached_player_id, game_record_id, created_at)
         VALUES (?, ?, NOW(3))`,
        [cachedPlayerId, gameRecordId],
      );
    }

    await connection.commit();
    return { gameRecordId, players: 4, existing: false };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
