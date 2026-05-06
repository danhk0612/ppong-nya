import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { PrismaClient } from "@prisma/client";

const databaseUrl = env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set before importing the server database client."
  );
}

const prismaClientSingleton = () =>
  new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log: dev ? ["query", "error", "warn"] : ["error"],
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
 */
export const db = globalForPrisma.prisma ?? prismaClientSingleton();

if (dev) {
  globalForPrisma.prisma = db;
}
