# syntax=docker/dockerfile:1
#
# Production image for Fly.io.
#
# Three stages so the runtime image carries neither the pnpm store nor the
# build toolchain: deps installs, builder compiles, runner ships only Next's
# standalone output plus the assets it reads at runtime.
#
# Debian slim rather than Alpine: the globe renders server-side never, but
# Next pulls in optional native deps (sharp) whose musl builds are a recurring
# source of "works locally, 500s in prod". The size difference does not
# justify that risk here.

ARG NODE_VERSION=22.22.0

# ─── Dependencies ───────────────────────────────────────────────────── #
FROM node:${NODE_VERSION}-slim AS deps
WORKDIR /app

# corepack pins pnpm to the version in package.json's packageManager field,
# so the image cannot drift from what the lockfile was resolved with.
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store && \
    pnpm install --frozen-lockfile

# ─── Build ──────────────────────────────────────────────────────────── #
FROM node:${NODE_VERSION}-slim AS builder
WORKDIR /app
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Refresh the orbital elements at image build time. This is deliberately
# best-effort: the script never fails the build (it keeps the committed
# snapshot if every source is unreachable), and it is worth attempting
# because Celestrak blocks some networks but not others — a builder that can
# reach it ships an image with the full catalogue rather than the
# amateur-mirror subset. pnpm does not run pre/post scripts by default, so
# this has to be invoked explicitly.
RUN pnpm cache:tle || true

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ─── Runtime ────────────────────────────────────────────────────────── #
FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    # Fly routes to the machine's private address, so binding to localhost
    # would make the app unreachable while looking perfectly healthy inside.
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# `public` is not decoration: lib/tle-cache-file.ts resolves the offline TLE
# snapshot as `join(process.cwd(), "public", "tle-cache.json")` at runtime,
# so omitting it silently disables the fallback that keeps the app populated
# when Celestrak is unreachable.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
