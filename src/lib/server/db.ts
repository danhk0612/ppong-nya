import { dev } from "$app/environment";
import { PrismaClient } from "@prisma/client";
import { privateEnv } from "$lib/server/env";

const DEFAULT_POOL_CONNECTION_LIMIT = dev ? "5" : "10";
const DEFAULT_POOL_TIMEOUT_SECONDS = "10";
const DEFAULT_CONNECT_TIMEOUT_SECONDS = "10";
const DEFAULT_TRANSACTION_MAX_WAIT_MS = 5_000;
const DEFAULT_TRANSACTION_TIMEOUT_MS = 10_000;

function withDefaultPoolPolicy(databaseUrl: string) {
  const url = new URL(databaseUrl);

  url.searchParams.set(
    "connection_limit",
    url.searchParams.get("connection_limit") ?? DEFAULT_POOL_CONNECTION_LIMIT,
  );
  url.searchParams.set(
    "pool_timeout",
    url.searchParams.get("pool_timeout") ?? DEFAULT_POOL_TIMEOUT_SECONDS,
  );
  url.searchParams.set(
    "connect_timeout",
    url.searchParams.get("connect_timeout") ?? DEFAULT_CONNECT_TIMEOUT_SECONDS,
  );

  return url.toString();
}

const prismaClientSingleton = () =>
  new PrismaClient({
    datasources: {
      db: {
        url: withDefaultPoolPolicy(privateEnv.databaseUrl),
      },
    },
    log: dev ? ["query", "error", "warn"] : ["error"],
    transactionOptions: {
      maxWait: DEFAULT_TRANSACTION_MAX_WAIT_MS,
      timeout: DEFAULT_TRANSACTION_TIMEOUT_MS,
    },
  });

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: ReturnType<typeof prismaClientSingleton>;
};

/**
 * Server-only Prisma client.
 *
 * Keep imports of this module inside SvelteKit server modules such as
 * `+page.server.ts`, `+layout.server.ts`, `+server.ts`, hooks, actions, or
 * other files below `$lib/server` so Prisma and DATABASE_URL never enter the
 * browser bundle.
 *
 * Pool policy: each process defaults to 5 connections in development and 10 in
 * production, waits up to 10 seconds for a free pooled connection, and waits up
 * to 10 seconds to establish a database connection. Interactive transactions
 * wait up to 5 seconds to start and may run for up to 10 seconds.
 */
export const db = globalForPrisma.prisma ?? prismaClientSingleton();

if (dev) {
  globalForPrisma.prisma = db;
}
