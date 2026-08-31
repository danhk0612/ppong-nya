import { dev } from "$app/environment";
import { env as privateRuntimeEnv } from "$env/dynamic/private";
import { env as publicRuntimeEnv } from "$env/dynamic/public";

function requireEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`${name} must be set.`);
  }

  return value;
}

export const privateEnv = {
  databaseUrl: requireEnv("DATABASE_URL", privateRuntimeEnv.DATABASE_URL),
} as const;

export const publicEnv = {
  siteName: publicRuntimeEnv.PUBLIC_SITE_NAME || "퐁냐",
  siteUrl: requireEnv("PUBLIC_SITE_URL", publicRuntimeEnv.PUBLIC_SITE_URL),
} as const;

export const productionOrigin = new URL(publicEnv.siteUrl).origin;
export const isProductionRuntime = !dev;
