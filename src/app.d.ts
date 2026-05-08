import type { UserRole } from "@prisma/client";

declare global {
  namespace App {
    interface Locals {
      auth(): Promise<import("@auth/sveltekit").Session | null>;
    }
    interface PageData {
      session?: import("@auth/sveltekit").Session | null;
    }
  }
}

declare module "@auth/sveltekit" {
  interface Session {
    user?: {
      id: string;
      role: UserRole;
      passwordChangeRequired: boolean;
      passwordChangeRequired: boolean;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    role: UserRole;
  }
}

export {};
