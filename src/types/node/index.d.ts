declare module "node:crypto" {
  export function randomBytes(size: number): {
    toString(encoding?: string): string;
  };

  export function pbkdf2Sync(
    password: string,
    salt: string,
    iterations: number,
    keylen: number,
    digest: string,
  ): Uint8Array & { toString(encoding?: string): string };

  export function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean;
}

declare const Buffer: {
  from(value: string, encoding?: string): Uint8Array;
};

declare const process: {
  env: Record<string, string | undefined>;
};
