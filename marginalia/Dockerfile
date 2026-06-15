# Marginalia — single image: build the PWA, then run the Hono server (which
# migrates-on-start and serves API + static PWA). One process, one URL (§3.10).
FROM node:22-bookworm-slim

WORKDIR /app
RUN corepack enable

# Install deps first (cache-friendly). Copy every workspace manifest + lockfile.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/core/package.json ./packages/core/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# App source.
COPY . .

# Build the PWA (server bundles via tsx at runtime — no separate compile step).
RUN pnpm --filter @marginalia/web build

ENV NODE_ENV=production \
    PORT=8080 \
    DATABASE_URL=file:/data/app.db \
    MIGRATIONS_DIR=./drizzle \
    SOURCES_CONFIG_PATH=./config/sources.yaml \
    WEB_DIST=./apps/web/dist

EXPOSE 8080

# The server runs migrations on boot, then serves. APP_TOKEN / ANTHROPIC_API_KEY
# come from Fly secrets at runtime (never baked into the image).
CMD ["pnpm", "tsx", "apps/server/src/index.ts"]
