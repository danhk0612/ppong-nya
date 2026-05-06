# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
# Prefer the committed npm lockfile; generate one only for repositories that do not ship it yet.
RUN if [ ! -f package-lock.json ]; then npm install --package-lock-only --ignore-scripts; fi && npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY package*.json ./
RUN if [ ! -f package-lock.json ]; then npm install --package-lock-only --ignore-scripts; fi \
    && npm ci --omit=dev \
    && npm cache clean --force

COPY --from=build /app/build ./build

EXPOSE 3000

# Inject runtime configuration such as DATABASE_URL, GOOGLE_CLIENT_ID,
# GOOGLE_CLIENT_SECRET, AUTH_SECRET, PUBLIC_SITE_URL, and optional ORIGIN with `docker run -e`,
# Docker Compose `environment`, or an orchestrator secret manager.
CMD ["node", "build"]
