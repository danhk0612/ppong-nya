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

function asUtcSqlDate(unixSeconds) {
  if (!unixSeconds) return null;
  const date = new Date(Number(unixSeconds) * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 23).replace("T", " ");
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
    const startedAt = asUtcSqlDate(head?.start_time);
    const endedAt = asUtcSqlDate(head?.end_time || head?.start_time);
    if (!startedAt) {
      console.warn(`[time-backfill] skip ${row.uuid}: missing start_time`);
      continue;
    }

    await db.execute(
      `UPDATE game_records
          SET startedAt=?, endedAt=?, updatedAt=UTC_TIMESTAMP(3)
        WHERE id=?`,
      [startedAt, endedAt, row.gameRecordId],
    );
    await db.execute(
      `UPDATE collector_games
          SET start_time=?, end_time=?, updated_at=UTC_TIMESTAMP(3)
        WHERE uuid=?`,
      [startedAt, endedAt, row.uuid],
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

  console.log(`[time-backfill] repaired games=${repaired}`);
} finally {
  await db.end();
}
