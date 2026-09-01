import mysql from "mysql2/promise";
import { materializeCollectedGame } from "./materialize.mjs";

const DATABASE_URL = process.env.DATABASE_URL;
const LIMIT = Math.max(1, Math.min(1000, Number(process.env.MATERIALIZE_BATCH_SIZE || 100)));

if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const db = mysql.createPool(DATABASE_URL);

try {
  const [rows] = await db.execute(
    `SELECT cg.uuid, cg.head
       FROM collector_games cg
       LEFT JOIN game_records gr
         ON gr.source='majsoul-native' AND gr.uuid=cg.uuid
      WHERE cg.status='COLLECTED'
        AND cg.head IS NOT NULL
        AND gr.id IS NULL
      ORDER BY cg.completed_at ASC
      LIMIT ${LIMIT}`,
  );

  let materialized = 0;
  for (const row of rows) {
    const head = typeof row.head === "string" ? JSON.parse(row.head) : row.head;
    const result = await materializeCollectedGame(db, head);
    materialized += 1;
    console.log(`[materialize] ${row.uuid} gameRecord=${result.gameRecordId} players=${result.players}`);
  }

  console.log(`[materialize] completed count=${materialized}`);
} finally {
  await db.end();
}
