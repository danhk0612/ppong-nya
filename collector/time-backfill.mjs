import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const db = mysql.createPool(DATABASE_URL);

function parseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function epochSeconds(value) {
  if (value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : null;
}

try {
  const [rows] = await db.execute(
    `SELECT cg.uuid, cg.head, gr.id AS gameRecordId
       FROM collector_games cg
       JOIN game_records gr
         ON gr.source='majsoul-native' AND gr.uuid=cg.uuid
      WHERE cg.status='COLLECTED' AND cg.head IS NOT NULL
      ORDER BY cg.completed_at ASC`,
  );

  let repaired = 0;
  for (const row of rows) {
    const head = parseJson(row.head);
    const startEpoch = epochSeconds(head?.start_time);
    const endEpoch = epochSeconds(head?.end_time) ?? startEpoch;
    if (!startEpoch) {
      console.warn(`[time-backfill] skip ${row.uuid}: missing start_time`);
      continue;
    }

    await db.execute(
      `UPDATE game_records
          SET startedAt=TIMESTAMPADD(SECOND, ?, '1970-01-01 00:00:00'),
              endedAt=TIMESTAMPADD(SECOND, ?, '1970-01-01 00:00:00'),
              updatedAt=UTC_TIMESTAMP(3)
        WHERE id=?`,
      [startEpoch, endEpoch, row.gameRecordId],
    );
    await db.execute(
      `UPDATE collector_games
          SET start_time=TIMESTAMPADD(SECOND, ?, '1970-01-01 00:00:00'),
              end_time=TIMESTAMPADD(SECOND, ?, '1970-01-01 00:00:00'),
              updated_at=UTC_TIMESTAMP(3)
        WHERE uuid=?`,
      [startEpoch, endEpoch, row.uuid],
    );
    repaired += 1;
  }

  await db.execute(
    `UPDATE cached_players cp
       JOIN (
         SELECT DISTINCT cgr.cached_player_id
           FROM cached_player_game_records cgr
           JOIN game_records gr ON gr.id=cgr.game_record_id
          WHERE gr.source='majsoul-native'
       ) native_players ON native_players.cached_player_id=cp.id
        SET cp.last_updated_at=UTC_TIMESTAMP(3), cp.updated_at=UTC_TIMESTAMP(3)`,
  );

  const [[verification]] = await db.query(
    `SELECT
       COUNT(*) AS nativeGames,
       SUM(startedAt > UTC_TIMESTAMP(3) + INTERVAL 5 MINUTE) AS futureGames,
       MIN(startedAt) AS minStartedAt,
       MAX(startedAt) AS maxStartedAt,
       UTC_TIMESTAMP(3) AS utcNow
     FROM game_records
     WHERE source='majsoul-native'`,
  );

  console.log(`[time-backfill] repaired games=${repaired}`);
  console.log(
    `[time-backfill] verify native=${verification.nativeGames} future=${verification.futureGames} range=${verification.minStartedAt}..${verification.maxStartedAt} utcNow=${verification.utcNow}`,
  );
  if (Number(verification.futureGames || 0) > 0) {
    throw new Error(`time-backfill verification failed: ${verification.futureGames} native games are in the future`);
  }
} finally {
  await db.end();
}
