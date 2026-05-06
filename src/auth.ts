import { dev } from "$app/environment";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { SvelteKitAuth } from "@auth/sveltekit";
import Google from "@auth/sveltekit/providers/google";
import { db } from "$lib/server/db";
import { privateEnv, productionOrigin } from "$lib/server/env";

export const { handle } = SvelteKitAuth({
  adapter: PrismaAdapter(db),
  secret: privateEnv.authSecret,
  trustHost: !dev,
  useSecureCookies: !dev,
  providers: [
    Google({
      clientId: privateEnv.googleClientId,
      clientSecret: privateEnv.googleClientSecret,
    }),
  ],
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    redirect({ url }) {
      if (url.startsWith("/")) {
        return `${productionOrigin}${url}`;
      }

      if (new URL(url).origin === productionOrigin) {
        return url;
      }

      return productionOrigin;
    },
    session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
        session.user.role = user.role;
      }

      return session;
    },
  },
});
