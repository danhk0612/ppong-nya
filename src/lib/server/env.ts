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
  get databaseUrl() {
    return requireEnv("DATABASE_URL", privateRuntimeEnv.DATABASE_URL);
  },
} as const;

export const publicEnv = {
  get siteName() {
    return publicRuntimeEnv.PUBLIC_SITE_NAME || "퐁냐";
  },
  get siteUrl() {
    return requireEnv("PUBLIC_SITE_URL", publicRuntimeEnv.PUBLIC_SITE_URL);
  },
} as const;

let _productionOrigin: string | undefined;
export function getProductionOrigin() {
  if (!_productionOrigin) {
    _productionOrigin = new URL(publicEnv.siteUrl).origin;
  }
  return _productionOrigin;
}

export const isProductionRuntime = !dev;
