# Beaver monorepo image — builds either the API or the web app.
#
#   docker build --build-arg APP=api -t beaver-api .
#   docker build --build-arg APP=web -t beaver-web .
#
# Multi-stage, Bun hoisted install (required for NestJS/Prisma peer deps).
# The API runs straight from TS source via Bun; the web app is `next build` + `next start`.

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
WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3001
# Apply migrations, then start. Override CMD (e.g. to seed) at runtime.
CMD ["sh", "-c", "bun run db:deploy && bun src/main.ts"]

# ── web-builder: build the Next.js app ──
FROM deps AS web-builder
WORKDIR /app
# Bake NEXT_PUBLIC_API_URL at build time (Next inlines public env vars).
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_TELEMETRY_DISABLED=1
COPY apps/api apps/api
COPY apps/web apps/web
COPY packages/shared packages/shared
RUN bun run --filter web build

# ── web: runtime ──
FROM oven/bun:1.4.0 AS web
# Keep dev deps are not needed at runtime, but hoisted workspace symlinks (incl.
# transpiled @beaver/shared) are — reuse the built node_modules for correctness.
COPY --from=web-builder /app/node_modules ./node_modules
COPY --from=web-builder /app/packages ./packages
COPY --from=web-builder /app/apps/web ./apps/web
COPY --from=web-builder /app/apps/api ./apps/api
WORKDIR /app/apps/web
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "start"]
