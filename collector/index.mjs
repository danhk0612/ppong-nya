import mysql from "mysql2/promise";
import { MajsoulClient } from "./majsoul-client.mjs";
import { FOUR_PLAYER_RANKED_MODES, MODE_IDS } from "./modes.mjs";

const DATABASE_URL = process.env.DATABASE_URL;
const ACCESS_TOKEN = process.env.MAJSOUL_ACCESS_TOKEN;
const POLL_INTERVAL_MS = Math.max(5000, Number(process.env.COLLECTOR_POLL_INTERVAL_MS || 7000));
const RECORD_DELAY_MS = Math.max(5 * 60_000, Number(process.env.COLLECTOR_RECORD_DELAY_MS || 20 * 60_000));
const BATCH_SIZE = Math.max(1, Math.min(100, Number(process.env.COLLECTOR_RECORD_BATCH_SIZE || 20)));
const LIST_ONLY = /^(1|true|yes)$/i.test(process.env.COLLECTOR_LIST_ONLY || "");
const ONE_SHOT = /^(1|true|yes)$/i.test(process.env.COLLECTOR_ONE_SHOT || "");

if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!ACCESS_TOKEN) throw new Error("MAJSOUL_ACCESS_TOKEN is required");

const db = mysql.createPool(DATABASE_URL);
let stopping = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const asDate = (unixSeconds) => unixSeconds ? new Date(Number(unixSeconds) * 1000) : null;
const compactError = (error) => String(error?.message || error || "unknown error").slice(0, 4000);

async function recoverInterruptedWork() {
  await db.execute(
    `UPDATE collector_games
        SET status='RETRY', next_attempt_at=NOW(3), last_error='collector restarted during fetch', updated_at=NOW(3)
      WHERE status='FETCHING'`,
  );
}

async function saveDiscoveredGame(game, filterId, expectedModeId) {
  const uuid = String(game.uuid || "");
  if (!uuid) return;
  await db.execute(
    `INSERT INTO collector_games
      (uuid, filter_id, expected_mode_id, start_time, status, first_seen_at, last_seen_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'DISCOVERED', NOW(3), NOW(3), NOW(3), NOW(3))
     ON DUPLICATE KEY UPDATE
      filter_id = VALUES(filter_id), expected_mode_id = VALUES(expected_mode_id),
      start_time = COALESCE(start_time, VALUES(start_time)), last_seen_at = NOW(3), updated_at = NOW(3)`,
    [uuid, filterId, expectedModeId, asDate(game.start_time)],
  );
}

async function pollLiveGames(client) {
  let total = 0;
  for (const mode of FOUR_PLAYER_RANKED_MODES) {
    if (stopping) break;
    const response = await client.fetchLiveList(mode.filterId);
    const games = Array.isArray(response.live_list) ? response.live_list : [];
    for (const game of games) await saveDiscoveredGame(game, mode.filterId, mode.modeId);
    total += games.length;
    console.log(`[collector] ${mode.room} ${mode.round}: ${games.length} live games`);
    await sleep(120);
  }
  return total;
}

async function downloadRecordData(record) {
  if (record.data && Buffer.isBuffer(record.data) && record.data.length) return record.data;
  if (record.data?.type === "Buffer" && Array.isArray(record.data.data)) return Buffer.from(record.data.data);
  if (!record.data_url) return null;
  const response = await fetch(record.data_url);
  if (!response.ok) throw new Error(`record data download failed: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function markRetry(uuid, error, minutes = 15) {
  await db.execute(
    `UPDATE collector_games
       SET status='RETRY', attempts=attempts+1, last_error=?,
           next_attempt_at=DATE_ADD(NOW(3), INTERVAL ? MINUTE), updated_at=NOW(3)
     WHERE uuid=?`,
    [compactError(error), minutes, uuid],
  );
}

async function processPendingRecords(client) {
  const cutoff = new Date(Date.now() - RECORD_DELAY_MS);
  const [rows] = await db.execute(
    `SELECT uuid, expected_mode_id AS expectedModeId, attempts
       FROM collector_games
      WHERE status IN ('DISCOVERED','RETRY')
        AND (start_time IS NULL OR start_time <= ?)
        AND (next_attempt_at IS NULL OR next_attempt_at <= NOW(3))
      ORDER BY COALESCE(start_time, first_seen_at) ASC
      LIMIT ${BATCH_SIZE}`,
    [cutoff],
  );

  for (const row of rows) {
    if (stopping) break;
    const uuid = String(row.uuid);
    try {
      await db.execute(`UPDATE collector_games SET status='FETCHING', updated_at=NOW(3) WHERE uuid=?`, [uuid]);
      const record = await client.fetchGameRecord(uuid);
      const head = record.head;
      if (!head || (!record.data && !record.data_url)) {
        await markRetry(uuid, record.error?.code ? `record not ready: ${record.error.code}` : "record not ready", Math.min(120, 10 + Number(row.attempts || 0) * 5));
        continue;
      }
      const modeId = Number(head?.config?.meta?.mode_id || 0);
      if (!MODE_IDS.has(modeId)) {
        await db.execute(
          `UPDATE collector_games SET status='IGNORED', mode_id=?, head=?, last_error=?, updated_at=NOW(3) WHERE uuid=?`,
          [modeId || null, JSON.stringify(head), `unsupported mode ${modeId}`, uuid],
        );
        continue;
      }
      const recordData = await downloadRecordData(record);
      if (!recordData?.length) {
        await markRetry(uuid, "record payload is empty", 30);
        continue;
      }
      await db.execute(
        `UPDATE collector_games
            SET status='COLLECTED', mode_id=?, start_time=COALESCE(?, start_time), end_time=?,
                head=?, record_data=?, attempts=attempts+1, last_error=NULL,
                next_attempt_at=NULL, completed_at=NOW(3), updated_at=NOW(3)
          WHERE uuid=?`,
        [modeId, asDate(head.start_time), asDate(head.end_time), JSON.stringify(head), recordData, uuid],
      );
      console.log(`[collector] collected ${uuid} mode=${modeId} bytes=${recordData.length}`);
    } catch (error) {
      console.warn(`[collector] failed ${uuid}: ${compactError(error)}`);
      await markRetry(uuid, error, 15);
    }
    await sleep(250);
  }
}

async function heartbeat(message = null) {
  await db.execute(
    `INSERT INTO collector_state (state_key, heartbeat_at, last_message, created_at, updated_at)
     VALUES ('main', NOW(3), ?, NOW(3), NOW(3))
     ON DUPLICATE KEY UPDATE heartbeat_at=NOW(3), last_message=VALUES(last_message), updated_at=NOW(3)`,
    [message],
  );
}

async function run() {
  await recoverInterruptedWork();
  const client = new MajsoulClient({
    accessToken: ACCESS_TOKEN,
    oauthType: process.env.MAJSOUL_OAUTH_TYPE || 7,
    baseUrl: process.env.MAJSOUL_URL_BASE,
    loginRegion: process.env.MAJSOUL_LOGIN_REGION || "en",
  });
  try {
    const login = await client.connect();
    console.log(`[collector] connected account=${login.account_id}`);
    await heartbeat("connected");
    do {
      const started = Date.now();
      try {
        const count = await pollLiveGames(client);
        if (!LIST_ONLY) await processPendingRecords(client);
        await heartbeat(`live=${count}`);
      } catch (error) {
        console.error(`[collector] cycle failed: ${compactError(error)}`);
        await heartbeat(`error: ${compactError(error)}`).catch(() => {});
        throw error;
      }
      if (ONE_SHOT) break;
      await sleep(Math.max(0, POLL_INTERVAL_MS - (Date.now() - started)));
    } while (!stopping);
  } finally {
    client.close();
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => { stopping = true; });
}

run()
  .catch((error) => { console.error(`[collector] fatal: ${compactError(error)}`); process.exitCode = 1; })
  .finally(async () => { await db.end(); });
