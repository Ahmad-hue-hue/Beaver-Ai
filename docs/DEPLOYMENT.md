# Beaver — single-host production deployment

Everything runs on one Docker host: Postgres + Redis (internal only), PgBouncer,
the NestJS API, and the Next.js web app. `docker-compose.prod.yml` is the source of
truth for topology and defaults; this doc is the runbook.

## Topology

```
                     ┌──────────┐
  TLS reverse proxy →│  web:80  │  Next.js standalone server
   (optional)        └────┬─────┘
                          │  HTTP (docker network)
                     ┌────▼─────┐        ┌──────────┐
                     │ api:3001 │ ──────►│ pgbouncer│ ─► postgres:5432
                     └──────────┘        └──────────┘    (~/.evmap beaver_pgdata)
                          │
                          └──────────────► redis:6379   (beaver_redisdata)
```

- The API talks to Postgres through **PgBouncer** (transaction pooling, bounded
  connections). **Migrations bypass it** via `DIRECT_URL` — required, because DDL
  is not safe through the transaction pooler.
- Postgres and Redis are never published to the host; only `api` (default host port
  `3001`) and `web` (default host port `80`) are reachable.
- The **web image bakes `NEXT_PUBLIC_API_URL` at build time**. Set it to the publicly
  reachable API origin *before* building. If web and API share one origin behind a
  reverse proxy, route `/api/*` to the API and point `NEXT_PUBLIC_API_URL` at the
  same origin.

## 0. First-time secrets

Copy `.env.example` to `.env` and fill in **all** secrets:

```bash
cp .env.example .env
openssl rand -hex 48     # → JWT_ACCESS_SECRET
openssl rand -hex 48     # → JWT_REFRESH_SECRET
openssl rand -hex 32     # → POSTGRES_PASSWORD (change it)
```

Required before `up`:

| Variable | Why |
|---|---|
| `JWT_ACCESS_SECRET` | signs access JWTs (compose fails fast if unset) |
| `JWT_REFRESH_SECRET` | signs refresh JWTs (compose fails fast if unset) |
| `POSTGRES_PASSWORD` | DB superuser password (default is a dev-only value) |
| `ADMIN_PHONE` / `ADMIN_PASSWORD` | auto-creates the first platform admin on API boot (optional, but you need *some* way to approve registrations) |
| `OPENROUTER_API_KEY` | enables the AI assistant; omit to run with the mock provider |
| `SENTRY_DSN` | optional error tracking; omit to keep Sentry a no-op |
| `BEAVER_PUBLIC_API_URL` | must be the **final public** API origin (baked into the web build) |
| `COOKIE_SECURE` | set `true` once TLS is in front |

**⚠ Rotation:** if any key ever leaked (for example, one was previously committed to
a public GitHub history), rotate it immediately — generate a new value, update `.env`,
redeploy, and revoke the old one at the provider (OpenRouter/Sentry). Do **not** put
real keys in this file for `docs/`, `README`, or any tracked example.

## 1. Deploy

```bash
# First build bakes NEXT_PUBLIC_API_URL — keep origin stable across redeploys.
BEAVER_PUBLIC_API_URL=https://api.yourdomain.com \
docker compose -f docker-compose.prod.yml up -d --build
```

- The API container runs `prisma migrate deploy` (via `DIRECT_URL`) before starting,
  then serves on `:3001` as the non-root `bun` user.
- Poll health: `curl -s http://localhost:3001/api/v1/health/ready` → 200
  `{"status":"ok","services":{"database":"up","redis":"up"}}`. `:3001/api/v1/health/live`
  is the liveness probe (always 200 while the process is up).

## 2. Upgrade / redeploy

```bash
git pull
BEAVER_PUBLIC_API_URL=https://api.yourdomain.com \
docker compose -f docker-compose.prod.yml up -d --build
```

New DB migrations apply automatically on API restart. Restart the web container too if
`NEXT_PUBLIC_API_URL` changed.

## 3. Backups

`scripts/backup.sh` dumps Postgres to timestamped gzip files and keeps the last
`RETENTION` (default 14). Backups land in `./backups` — **copy them off the host**.

```cron
# cron as the deploy user (from the repo root):
0 2 * * * /opt/beaver/scripts/backup.sh >> /var/log/beaver-backup.log 2>&1
```

Restore:

```bash
gunzip < ./backups/beaver-<stamp>.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Note: `POSTGRES_PORT` for a host cron defaults to `5544` in `backup.sh` (local dev).
In production the DB is not published to the host, so run the cron the way the script
documents (from inside the network, or pass `POSTGRES_PORT` for a published port).

## 4. Data retention

The API sweeps old rows on a schedule (starts 10 min after boot, then every 6 h):

- `AUDIT_RETENTION_DAYS` (default 365) — AuditLog rows older than this are deleted.
- `MOVEMENT_RETENTION_DAYS` (default 730) — InventoryMovement rows older than this.

Set either to `0` to disable that sweep. Deletes run in batches inside a transaction.

## 5. Observability

- **Logs** are structured JSON (Pino), one request line per call, secrets in headers
  redacted. Docker log rotation is already configured per service:
  `docker compose -f docker-compose.prod.yml logs -f api`.
- **Sentry** (error tracking): set `SENTRY_DSN` and redeploy. Without it, the SDK is a
  no-op. `tracesSampleRate` is `0` — runtime logging/errors only, no span tracing.
- **Health**: `/health/live` for liveness, `/health/ready` for readiness (DB + Redis),
  `/health` as a compatibility alias of ready-with-status.

## 6. TLS + cookies

Put a reverse proxy (Caddy, nginx, Traefik) in front of `web` and `api`:

- web on `https://yourdomain`, api on `https://api.yourdomain`
  (or same origin, routing `/api/*` to the API).
- Then set `COOKIE_SECURE=true`, `COOKIE_DOMAIN=yourdomain`, `CORS_ORIGINS=https://yourdomain`.
- Rebuild only if `CORS_ORIGINS`/`BEAVER_PUBLIC_API_URL` changed (compose passes
  `CORS_ORIGINS` at runtime; `BEAVER_PUBLIC_API_URL` is baked at build time).

## 7. Operational notes / limits

- **Rate limiting is in-memory** (per API instance). Fine on a single host; if you ever
  run multiple API replicas, move the throttler to Redis storage.
- **The PWA is offline-ready**: `public/sw.js` serves the app shell + static assets
  from cache and falls back to `/login` offline. The API is never cached; refresh the
  index/verification that prevents stale UI only after deploying new service-worker
  versions will register at the next production page load.
- **AI** runs the mock provider unless `OPENROUTER_API_KEY` is set. Free-tier OpenRouter
  models are rate-limited; the provider retries transient overloads (3 backoff attempts)
  before returning 500.

## FAQ

- **Why not expose Postgres?** Nothing outside the compose network needs it; backups go
  through `pg_dump` inside the network. Fewer published ports = less attack surface.
- **Why `connection_limit=10` on `DATABASE_URL`?** Prisma caps its client pool so
  PgBouncer's default pool isn't exhausted by one app.
- **Why `pgbouncer=true` in the URL?** Prisma emits `PREPARE`-safe queries; this flag
  makes it skip prepared-statement mode that breaks under transaction pooling.