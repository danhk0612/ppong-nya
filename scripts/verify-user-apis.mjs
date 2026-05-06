#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";

const requiredEnv = [
  "BASE_URL",
  "DATABASE_URL",
  "USER_A_COOKIE",
  "USER_B_COOKIE",
];
const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(
    `Missing required environment variables: ${missing.join(", ")}`,
  );
  console.error(
    "Set BASE_URL, DATABASE_URL, USER_A_COOKIE, and USER_B_COOKIE before running this verifier.",
  );
  process.exit(1);
}

const baseUrl = process.env.BASE_URL.replace(/\/$/, "");
const userACookie = process.env.USER_A_COOKIE;
const userBCookie = process.env.USER_B_COOKIE;
const prisma = new PrismaClient();

const endpoints = [
  "/api/preferences",
  "/api/favorites",
  "/api/game-records",
  "/api/notes",
  "/api/account",
];

function hangul(text) {
  return /[가-힣]/.test(text);
}

async function request(path, { method = "GET", cookie, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const text = await response.text();
  let json;

  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }

  return { response, text, json };
}

function assertStatus(result, expected, label) {
  assert.equal(
    result.response.status,
    expected,
    `${label}: expected HTTP ${expected}, got ${result.response.status}: ${result.text}`,
  );
}

async function expectKorean4xx(path, body, label) {
  const result = await request(path, {
    method: "POST",
    cookie: userACookie,
    body,
  });
  assert.ok(
    result.response.status >= 400 && result.response.status < 500,
    `${label}: expected 400-level response, got ${result.response.status}: ${result.text}`,
  );
  assert.ok(
    hangul(result.text),
    `${label}: expected Korean error text, got: ${result.text}`,
  );
}

async function expectBlocked(path, method, body, label) {
  const result = await request(path, { method, cookie: userBCookie, body });
  assert.ok(
    result.response.status === 403 || result.response.status === 404,
    `${label}: expected 403/404 for another user's data, got ${result.response.status}: ${result.text}`,
  );
  assert.ok(
    hangul(result.text),
    `${label}: expected Korean blocked error text, got: ${result.text}`,
  );
}

async function main() {
  console.log(
    "1. Checking unauthenticated API access returns 401 or redirect.",
  );
  for (const endpoint of endpoints) {
    const result = await request(endpoint);
    assert.ok(
      result.response.status === 401 ||
        (result.response.status >= 300 && result.response.status < 400),
      `${endpoint}: expected 401 or redirect, got ${result.response.status}`,
    );
  }

  console.log("2. Checking authenticated /api/account GET for both users.");
  const accountA = await request("/api/account", { cookie: userACookie });
  const accountB = await request("/api/account", { cookie: userBCookie });
  assertStatus(accountA, 200, "user A account GET");
  assertStatus(accountB, 200, "user B account GET");
  const userAId = accountA.json?.user?.id;
  const userBId = accountB.json?.user?.id;
  assert.ok(userAId, "user A id was not returned by /api/account");
  assert.ok(userBId, "user B id was not returned by /api/account");
  assert.notEqual(
    userAId,
    userBId,
    "USER_A_COOKIE and USER_B_COOKIE must belong to different users",
  );

  console.log(
    "3. Checking preferences POST, GET, PATCH, DELETE and user_preferences table.",
  );
  const preferenceKey = `verify.preference.${Date.now()}`;
  const preferenceCreate = await request("/api/preferences", {
    method: "POST",
    cookie: userACookie,
    body: { key: preferenceKey, value: { locale: "ko", visible: true } },
  });
  assertStatus(preferenceCreate, 201, "preference POST");
  const preferenceId = preferenceCreate.json.preference.id;
  assert.deepEqual(
    await prisma.userPreference
      .findUnique({ where: { id: preferenceId } })
      .then((row) => row?.value),
    { locale: "ko", visible: true },
    "preference POST was not reflected in user_preferences.value",
  );
  const preferencesList = await request("/api/preferences", {
    cookie: userACookie,
  });
  assertStatus(preferencesList, 200, "preferences GET");
  assert.ok(
    preferencesList.json.preferences.some((row) => row.id === preferenceId),
    "preferences GET did not include the created preference",
  );
  await expectBlocked(
    "/api/preferences",
    "PATCH",
    { id: preferenceId, value: { locale: "ja" } },
    "preference PATCH by another user",
  );
  const preferencePatch = await request("/api/preferences", {
    method: "PATCH",
    cookie: userACookie,
    body: { id: preferenceId, value: { locale: "en" } },
  });
  assertStatus(preferencePatch, 200, "preference PATCH");
  assert.deepEqual(
    await prisma.userPreference
      .findUnique({ where: { id: preferenceId } })
      .then((row) => row?.value),
    { locale: "en" },
    "preference PATCH was not reflected in user_preferences.value",
  );

  console.log(
    "4. Checking favorites POST, GET, PATCH, DELETE and favorite_players table.",
  );
  const playerId = `verify-player-${Date.now()}`;
  const favoriteCreate = await request("/api/favorites", {
    method: "POST",
    cookie: userACookie,
    body: { playerId, nickname: "검증냥", server: "kr", memo: "생성" },
  });
  assertStatus(favoriteCreate, 201, "favorite POST");
  const favoriteId = favoriteCreate.json.favorite.id;
  assert.equal(
    await prisma.favoritePlayer
      .findUnique({ where: { id: favoriteId } })
      .then((row) => row?.nickname),
    "검증냥",
    "favorite POST was not reflected in favorite_players.nickname",
  );
  const favoritesList = await request("/api/favorites", {
    cookie: userACookie,
  });
  assertStatus(favoritesList, 200, "favorites GET");
  assert.ok(
    favoritesList.json.favorites.some((row) => row.id === favoriteId),
    "favorites GET did not include the created favorite",
  );
  await expectBlocked(
    "/api/favorites",
    "PATCH",
    { id: favoriteId, nickname: "침입자" },
    "favorite PATCH by another user",
  );
  const favoritePatch = await request("/api/favorites", {
    method: "PATCH",
    cookie: userACookie,
    body: { id: favoriteId, nickname: "검증냥-수정", memo: "수정" },
  });
  assertStatus(favoritePatch, 200, "favorite PATCH");
  assert.equal(
    await prisma.favoritePlayer
      .findUnique({ where: { id: favoriteId } })
      .then((row) => row?.nickname),
    "검증냥-수정",
    "favorite PATCH was not reflected in favorite_players.nickname",
  );

  console.log(
    "5. Checking game-records POST, GET, PATCH, DELETE and game_records/players tables.",
  );
  const recordCreate = await request("/api/game-records", {
    method: "POST",
    cookie: userACookie,
    body: {
      mode: "YONMA",
      startedAt: "2026-05-06T00:00:00.000Z",
      tableName: "검증탁",
      rounds: 8,
      players: [
        { seat: 0, nickname: "동", score: 32000, placement: 1 },
        { seat: 1, nickname: "남", score: 28000, placement: 2 },
        { seat: 2, nickname: "서", score: 22000, placement: 3 },
        { seat: 3, nickname: "북", score: 18000, placement: 4 },
      ],
    },
  });
  assertStatus(recordCreate, 201, "game-record POST");
  const recordId = recordCreate.json.record.id;
  assert.equal(
    await prisma.gameRecord
      .findUnique({ where: { id: recordId } })
      .then((row) => row?.tableName),
    "검증탁",
    "game-record POST was not reflected in game_records.tableName",
  );
  assert.equal(
    await prisma.player.count({ where: { gameRecordId: recordId } }),
    4,
    "game-record POST did not create four rows in players",
  );
  const recordsList = await request("/api/game-records", {
    cookie: userACookie,
  });
  assertStatus(recordsList, 200, "game-records GET");
  assert.ok(
    recordsList.json.records.some((row) => row.id === recordId),
    "game-records GET did not include the created record",
  );
  await expectBlocked(
    "/api/game-records",
    "PATCH",
    { id: recordId, tableName: "침입탁" },
    "game-record PATCH by another user",
  );
  const recordPatch = await request("/api/game-records", {
    method: "PATCH",
    cookie: userACookie,
    body: {
      id: recordId,
      mode: "SANMA",
      tableName: "검증탁-수정",
      players: [
        { seat: 0, nickname: "동수정", score: 35000, placement: 1 },
        { seat: 1, nickname: "남수정", score: 25000, placement: 2 },
        { seat: 2, nickname: "서수정", score: 15000, placement: 3 },
      ],
    },
  });
  assertStatus(recordPatch, 200, "game-record PATCH");
  assert.equal(
    await prisma.gameRecord
      .findUnique({ where: { id: recordId } })
      .then((row) => row?.tableName),
    "검증탁-수정",
    "game-record PATCH was not reflected in game_records.tableName",
  );
  assert.equal(
    await prisma.player.count({ where: { gameRecordId: recordId } }),
    3,
    "game-record PATCH did not replace player rows in players",
  );

  console.log(
    "6. Checking notes POST, GET, PATCH, DELETE and game_notes table.",
  );
  const noteCreate = await request("/api/notes", {
    method: "POST",
    cookie: userACookie,
    body: {
      gameRecordId: recordId,
      title: "검증 메모",
      body: "본문",
      tags: ["테스트"],
    },
  });
  assertStatus(noteCreate, 201, "note POST");
  const noteId = noteCreate.json.note.id;
  assert.equal(
    await prisma.gameNote
      .findUnique({ where: { id: noteId } })
      .then((row) => row?.gameRecordId),
    recordId,
    "note POST was not reflected in game_notes.gameRecordId",
  );
  const notesList = await request("/api/notes", { cookie: userACookie });
  assertStatus(notesList, 200, "notes GET");
  assert.ok(
    notesList.json.notes.some((row) => row.id === noteId),
    "notes GET did not include the created note",
  );
  await expectBlocked(
    "/api/notes",
    "PATCH",
    { id: noteId, title: "침입 메모" },
    "note PATCH by another user",
  );
  const notePatch = await request("/api/notes", {
    method: "PATCH",
    cookie: userACookie,
    body: { id: noteId, title: "검증 메모-수정", body: "본문-수정" },
  });
  assertStatus(notePatch, 200, "note PATCH");
  assert.equal(
    await prisma.gameNote
      .findUnique({ where: { id: noteId } })
      .then((row) => row?.title),
    "검증 메모-수정",
    "note PATCH was not reflected in game_notes.title",
  );

  console.log("7. Checking invalid payloads return 400-level Korean errors.");
  await expectKorean4xx("/api/preferences", {}, "invalid preference payload");
  await expectKorean4xx(
    "/api/favorites",
    { playerId: playerId },
    "invalid favorite payload",
  );
  await expectKorean4xx(
    "/api/game-records",
    { mode: "INVALID" },
    "invalid game-record payload",
  );
  await expectKorean4xx(
    "/api/notes",
    { title: "제목만" },
    "invalid note payload",
  );

  console.log(
    "8. Cleaning up through DELETE endpoints and checking table deletion.",
  );
  await expectBlocked(
    "/api/notes",
    "DELETE",
    { id: noteId },
    "note DELETE by another user",
  );
  assertStatus(
    await request("/api/notes", {
      method: "DELETE",
      cookie: userACookie,
      body: { id: noteId },
    }),
    200,
    "note DELETE",
  );
  assert.equal(
    await prisma.gameNote.count({ where: { id: noteId } }),
    0,
    "note DELETE did not remove game_notes row",
  );

  await expectBlocked(
    "/api/game-records",
    "DELETE",
    { id: recordId },
    "game-record DELETE by another user",
  );
  assertStatus(
    await request("/api/game-records", {
      method: "DELETE",
      cookie: userACookie,
      body: { id: recordId },
    }),
    200,
    "game-record DELETE",
  );
  assert.equal(
    await prisma.gameRecord.count({ where: { id: recordId } }),
    0,
    "game-record DELETE did not remove game_records row",
  );
  assert.equal(
    await prisma.player.count({ where: { gameRecordId: recordId } }),
    0,
    "game-record DELETE did not cascade players rows",
  );

  await expectBlocked(
    "/api/favorites",
    "DELETE",
    { id: favoriteId },
    "favorite DELETE by another user",
  );
  assertStatus(
    await request("/api/favorites", {
      method: "DELETE",
      cookie: userACookie,
      body: { id: favoriteId },
    }),
    200,
    "favorite DELETE",
  );
  assert.equal(
    await prisma.favoritePlayer.count({ where: { id: favoriteId } }),
    0,
    "favorite DELETE did not remove favorite_players row",
  );

  await expectBlocked(
    "/api/preferences",
    "DELETE",
    { id: preferenceId },
    "preference DELETE by another user",
  );
  assertStatus(
    await request("/api/preferences", {
      method: "DELETE",
      cookie: userACookie,
      body: { id: preferenceId },
    }),
    200,
    "preference DELETE",
  );
  assert.equal(
    await prisma.userPreference.count({ where: { id: preferenceId } }),
    0,
    "preference DELETE did not remove user_preferences row",
  );

  console.log("All user API checks passed.");
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
