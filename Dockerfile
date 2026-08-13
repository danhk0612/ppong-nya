# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
# Prefer the committed npm lockfile; generate one only for repositories that do not ship it yet.
RUN if [ ! -f package-lock.json ]; then npm install --package-lock-only --ignore-scripts; fi && npm ci

COPY . .
# SvelteKit's post-build analysis imports server modules, so provide non-secret
# placeholders that are replaced by runtime configuration in the final image.
ENV DATABASE_URL=mysql://ppong_nya:ppong_nya_password@db:3306/ppong_nya \
    AUTH_SECRET=build-time-placeholder-auth-secret \
    GOOGLE_CLIENT_ID=build-time-placeholder.apps.googleusercontent.com \
    GOOGLE_CLIENT_SECRET=build-time-placeholder-google-client-secret \
    PUBLIC_SITE_URL=http://localhost:3000
RUN npm run db:generate && npm run build

FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY package*.json ./
RUN if [ ! -f package-lock.json ]; then npm install --package-lock-only --ignore-scripts; fi \
    && npm ci --omit=dev \
    && npm cache clean --force

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/build ./build
COPY --from=build /app/prisma ./prisma

USER node

EXPOSE 3000

# The same image serves the application and runs `prisma migrate deploy` from
# the one-shot migration service in the production Compose stack.
CMD ["node", "build"]
