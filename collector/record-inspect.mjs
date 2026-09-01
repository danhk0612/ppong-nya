import mysql from "mysql2/promise";
import { MajsoulClient } from "./majsoul-client.mjs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const db = mysql.createPool(DATABASE_URL);

function compact(value) {
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (Array.isArray(item)) result[key] = `[${item.length}]`;
    else if (item && typeof item === "object") result[key] = "{...}";
    else result[key] = item;
  }
  return result;
}

async function main() {
  const [rows] = await db.execute(
    `SELECT uuid, record_data AS recordData
       FROM collector_games
      WHERE status='COLLECTED' AND record_data IS NOT NULL
      ORDER BY completed_at DESC
      LIMIT 1`,
  );
  if (!rows.length) throw new Error("No collected record_data found");

  const client = new MajsoulClient({
    uid: process.env.MAJSOUL_UID,
    token: process.env.MAJSOUL_TOKEN,
    deviceId: process.env.MAJSOUL_DEVICE_ID,
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
    const decoded = client.decodeGameRecordData(rows[0].recordData);
    const counts = new Map();
    for (const record of decoded.records) {
      counts.set(record.name, (counts.get(record.name) ?? 0) + 1);
    }

    console.log(`[inspect] uuid=${rows[0].uuid} outer=${decoded.name} records=${decoded.records.length}`);
    for (const [name, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`[inspect] ${name} ${count}`);
    }

    for (const target of [".lq.RecordNewRound", ".lq.RecordDiscardTile", ".lq.RecordChiPengGang", ".lq.RecordHule", ".lq.RecordNoTile", ".lq.RecordLiuJu"]) {
      const record = decoded.records.find((item) => item.name === target);
      if (record) console.log(`[inspect] sample ${target} ${JSON.stringify(compact(record.payload))}`);
    }
  } finally {
    client.close();
    await db.end();
  }
}

main().catch((error) => {
  console.error(`[inspect] fatal: ${error?.stack || error}`);
  process.exitCode = 1;
});
