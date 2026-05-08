import { timingSafeEqual, randomBytes, pbkdf2Sync } from "node:crypto";

const HASH_ALGORITHM = "pbkdf2-sha256";
const HASH_ITERATIONS = 210_000;
const HASH_KEY_LENGTH = 32;
const HASH_DIGEST = "sha256";

export function validatePassword(password: string) {
  if (password.length < 8) {
    return "비밀번호는 8자 이상이어야 합니다.";
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "비밀번호에는 영문자와 숫자를 모두 포함해야 합니다.";
  }

  return undefined;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(
    password,
    salt,
    HASH_ITERATIONS,
    HASH_KEY_LENGTH,
    HASH_DIGEST,
  ).toString("base64url");

  return `${HASH_ALGORITHM}$${HASH_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string | null) {
  if (!storedHash) {
    return false;
  }

  const [algorithm, iterationsValue, salt, hash] = storedHash.split("$");
  const iterations = Number.parseInt(iterationsValue ?? "", 10);

  if (algorithm !== HASH_ALGORITHM || !salt || !hash || !iterations) {
    return false;
  }

  const expectedHash = Buffer.from(hash, "base64url");
  const actualHash = pbkdf2Sync(
    password,
    salt,
    iterations,
    expectedHash.length,
    HASH_DIGEST,
  );

  return (
    actualHash.length === expectedHash.length &&
    timingSafeEqual(actualHash, expectedHash)
  );
}
