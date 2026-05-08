import { db } from "$lib/server/db";
import { privateEnv } from "$lib/server/env";
import { hashPassword } from "$lib/server/password";

let ensureDefaultAdminPromise: Promise<void> | undefined;

export function ensureDefaultAdmin() {
  ensureDefaultAdminPromise ??= upsertDefaultAdmin().catch((cause) => {
    ensureDefaultAdminPromise = undefined;
    throw cause;
  });

  return ensureDefaultAdminPromise;
}

async function upsertDefaultAdmin() {
  const email = privateEnv.defaultAdminEmail.toLowerCase();

  const existingAdmin = await db.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  if (existingAdmin) {
    return;
  }

  await db.user.upsert({
    where: { email },
    update: {
      role: "ADMIN",
      passwordHash: hashPassword(privateEnv.defaultAdminPassword),
      passwordChangeRequired: true,
    },
    create: {
      email,
      name: "기본 관리자",
      role: "ADMIN",
      passwordHash: hashPassword(privateEnv.defaultAdminPassword),
      passwordChangeRequired: true,
    },
  });
}
