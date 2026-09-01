import mysql from "mysql2/promise";
import { MajsoulClient } from "./majsoul-client.mjs";
import { updatePlayerRoundStats } from "./materialize.mjs";
import { calculateRoundStats } from "./record-stats.mjs";

const DATABASE_URL = process.env.DATABASE_URL;
const LIMIT = Math.max(1, Math.min(1000, Number(process.env.STATS_BACKFILL_BATCH_SIZE || 100)));
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const db = mysql.createPool(DATABASE_URL);
const client = new MajsoulClient({
  uid: process.env.MAJSOUL_UID,
  token: process.env.MAJSOUL_TOKEN,
  accessToken: process.env.MAJSOUL_ACCESS_TOKEN,
  oauthType: process.env.MAJSOUL_OAUTH_TYPE,
  baseUrl: process.env.MAJSOUL_URL_BASE,
  loginRegion: process.env.MAJSOUL_LOGIN_REGION || "kr",
  resourceVersion: process.env.MAJSOUL_RESOURCE_VERSION,
  productVersion: process.env.MAJSOUL_PRODUCT_VERSION,
  lobbyEndpoint: process.env.MAJSOUL_LOBBY_ENDPOINT,
});

try {
  await client.connect();
  const [rows] = await db.execute(
    `SELECT cg.uuid, cg.record_data AS recordData
       FROM collector_games cg
       JOIN game_records gr
         ON gr.source='majsoul-native' AND gr.uuid=cg.uuid
      WHERE cg.status='COLLECTED'
        AND cg.record_data IS NOT NULL
      ORDER BY cg.completed_at ASC
      LIMIT ${LIMIT}`,
  );

  let completed = 0;
  for (const row of rows) {
    const decoded = client.decodeGameRecordData(row.recordData);
    const stats = calculateRoundStats(decoded.records);
    const players = await updatePlayerRoundStats(db, row.uuid, stats);
    completed += 1;
    console.log(`[stats-backfill] ${row.uuid} records=${decoded.records.length} rounds=${stats[0]?.rounds ?? 0} players=${players}`);
  }
  console.log(`[stats-backfill] completed count=${completed}`);
} finally {
  client.close();
  await db.end();
}
