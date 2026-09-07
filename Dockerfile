# Beaver monorepo image — builds either the API or the web app.
#
#   docker build --build-arg APP=api -t beaver-api .
#   docker build --build-arg APP=web -t beaver-web .
#
# Multi-stage, Bun hoisted install (required for NestJS/Prisma peer deps).
# The API runs straight from TS source via Bun; the web app is `next build`
# with `output: 'standalone'`, served by the generated Node server.
# Both runtime stages run as the non-root `bun` user.

# ── deps: hoisted node_modules for the whole workspace ──
FROM oven/bun:1.4.0 AS deps
WORKDIR /app
COPY bun.lock bunfig.toml package.json tsconfig.base.json ./
# Copy workspace package manifests so Bun can resolve the workspace graph.
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN bun install --frozen-lockfile

# ── prisma: generate the client (needs the schema) ──
FROM deps AS prisma
WORKDIR /app
COPY apps/api apps/api
COPY packages/shared packages/shared
WORKDIR /app/apps/api
RUN bun run prisma generate

# ── api: runtime ──
FROM oven/bun:1.4.0 AS api
WORKDIR /app
COPY --from=prisma /app/node_modules ./node_modules
COPY --from=prisma /app/apps ./apps
COPY --from=prisma /app/packages ./packages
# tsconfig.base.json is extended by apps/*/tsconfig.json; Bun needs it to
# enable experimentalDecorators (native TC39 decorators break Nest's @OnEvent).
COPY --from=prisma /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=prisma /app/bunfig.toml ./bunfig.toml
WORKDIR /app/apps/api
ENV NODE_ENV=production HOME=/home/bun
EXPOSE 3001
# Apply migrations, then start. Override CMD (e.g. to seed) at runtime.
# Ownership must land on the non-root `bun` user (Prisma writes .cache etc.).
RUN chown -R bun:bun /app
USER bun
CMD ["sh", "-c", "bun run db:deploy && bun src/main.ts"]

# ── web-builder: build the Next.js app (standalone output) ──
FROM deps AS web-builder
WORKDIR /app
# Bake NEXT_PUBLIC_API_URL at build time (Next inlines public env vars).
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_TELEMETRY_DISABLED=1
COPY apps/api apps/api
COPY apps/web apps/web
COPY packages/shared packages/shared
RUN bun run --filter web build

# ── web: runtime (standalone server — slim, fast boot) ──
FROM oven/bun:1.4.0 AS web
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 HOME=/home/bun
# Standalone server bundles its own (traced) deps + the compiled workspace.
# With outputFileTracingRoot = the image's repo root (/app), the standalone tree is
# rooted at the monorepo root basename — always "app" inside the container.
COPY --from=web-builder /app/apps/web/.next/standalone ./
COPY --from=web-builder /app/apps/web/.next/static ./app/apps/web/.next/static
COPY --from=web-builder /app/apps/web/public ./app/apps/web/public
EXPOSE 3000
RUN chown -R bun:bun /app
USER bun
CMD ["node", "app/apps/web/server.js"]