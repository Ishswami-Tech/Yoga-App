# Production image for vishwayog (Next.js standalone output).
#
# Builds natively for whichever platform the builder runs on (linux/amd64 or
# linux/arm64); .github/workflows/docker-image.yml builds each platform on its
# own native GitHub runner and merges them into one multi-arch tag. Prisma's
# query engine and sharp's libvips are platform-specific, which is why each
# platform is built natively instead of cross-copied.
#
# Build from the repository root:
#   docker build -f docker/Dockerfile -t vishwayog .
#
# NEXT_PUBLIC_* values are inlined into the bundles by `next build`, so they are
# build args, not runtime env. Everything else (DATABASE_URL, AUTH_SECRET,
# CRON_SECRET, provider keys) is read at runtime and must come from Temps.

ARG NODE_IMAGE=node:22-bookworm-slim
ARG BUN_IMAGE=oven/bun:1

FROM ${BUN_IMAGE} AS bun

# ---------------------------------------------------------------------------
# deps: install node_modules with bun (bun.lock is the lockfile of record).
# postinstall runs `prisma generate`, so the schema must be present.
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock ./
COPY prisma ./prisma
# Hoisted (flat) node_modules keep Next's standalone file tracing simple
# (no symlinked package store to follow).
RUN bun install --frozen-lockfile --linker=hoisted

# ---------------------------------------------------------------------------
# build: prisma generate + next build (standalone).
# ---------------------------------------------------------------------------
FROM deps AS build
ARG NEXT_PUBLIC_APP_URL=https://www.shreevishwayogayurved.com
ARG NEXT_PUBLIC_APP_NAME="Shree Vishwayog Ayurved"
ARG NEXT_PUBLIC_SUPPORT_PHONE=
ARG NEXT_PUBLIC_SUPPORT_EMAIL=
ARG NEXT_PUBLIC_SENTRY_DSN=
ARG GIT_SHA=unknown
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME} \
    NEXT_PUBLIC_SUPPORT_PHONE=${NEXT_PUBLIC_SUPPORT_PHONE} \
    NEXT_PUBLIC_SUPPORT_EMAIL=${NEXT_PUBLIC_SUPPORT_EMAIL} \
    NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN} \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone \
    NODE_ENV=production
COPY . .
# next/font/google downloads the font files during the build, and those
# downloads fail intermittently on CI runners ("next/font/google queries have
# exactly one entry"). Retry the build a few times before giving up.
RUN for attempt in 1 2 3; do \
      bun run build && break; \
      if [ "$attempt" = 3 ]; then exit 1; fi; \
      echo "next build attempt $attempt failed; retrying in 15s"; sleep 15; \
    done \
 && test -f .next/standalone/server.js

# ---------------------------------------------------------------------------
# runtime: plain node running the standalone server, as a non-root user.
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
ARG GIT_SHA=unknown
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    GIT_SHA=${GIT_SHA}
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# Prisma schema + migrations travel with the image so `prisma migrate deploy`
# can be run from it by hand if wanted (the CLI itself is not bundled).
COPY --from=build --chown=node:node /app/prisma ./prisma
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/robots.txt" || exit 1
CMD ["node", "server.js"]
