# Beaver

An **AI-powered business operating system** for small and medium retail shops —
POS, inventory, purchases, suppliers, customers & debt, expenses, cash, deterministic
financial analytics, reporting, and an AI assistant + autonomous agents that study the
business (English & Kiswahili). Built multi-tenant and mobile-first for Tanzanian shops.

> Status: **in active construction** (milestone-based). M0–M8 complete (infra, auth/tenancy/RBAC,
> products/inventory, POS & sales, suppliers/purchases/expenses/cash/debt, analytics/reports,
> AI assistant + agents, notifications/employees/admin/security, and M8 polish/tests/docs/seed/
> deployment). See [`docs/ROADMAP.md`](docs/ROADMAP.md) for milestone scope.

## Stack

| Layer     | Choice |
|-----------|--------|
| Runtime   | **Bun** (workspaces, scripts, tests) |
| Backend   | **NestJS** (REST + OpenAPI/Swagger) |
| Database  | **PostgreSQL 18** (Docker, `pgvector` image) + **Prisma** |
| Cache/Jobs| **Redis** (cache-aside + BullMQ queue + rate limit) |
| Frontend  | **Next.js** (App Router, PWA) + Tailwind v4 + shadcn/ui + 21st.dev |
| AI        | **Claude `claude-opus-4-8`** via a provider abstraction (mock fallback) |

Money is `Decimal` end-to-end (never floats). Every business-scoped row carries `businessId`.

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.3
- Docker + Docker Compose v2

## Quick start

```bash
# 1. Install dependencies (hoisted linker — see bunfig.toml)
bun install

# 2. Configure environment
cp .env.example .env         # adjust ports if 5544/6390/3001/3000 are taken

# 3. Start infrastructure (Postgres + Redis)
docker compose up -d

# 4. Set up the database
cp .env apps/api/.env        # Prisma + API read this
bun --filter api prisma:generate
bun --filter api db:migrate

# 5. Run the apps (API :3001, web :3000)
bun run dev
```

- API health: http://localhost:3001/api/v1/health
- API docs (Swagger): http://localhost:3001/docs
- Web: http://localhost:3000

The AI features work without a key via a mock provider; set `ANTHROPIC_API_KEY` in `.env`
for live Claude responses.

## Monorepo layout

```
apps/api        NestJS backend (Prisma, modules per domain)
apps/web        Next.js PWA
packages/shared TypeScript shared: money, roles, permissions, i18n
infra/postgres  DB init (extensions)
docker-compose.yml
```

## Scripts (root)

| Command | What |
|---------|------|
| `bun run dev` | Run API + web in parallel |
| `bun test` | Run all workspace tests |
| `bun run db:migrate` | Apply Prisma migrations |
| `bun run db:seed` | Seed demo data |
| `bun run infra:up` / `infra:down` | Start / stop Docker services |

## Notes

- Bun uses the **hoisted** linker (`bunfig.toml`) because the NestJS/Prisma ecosystem
  expects a hoisted `node_modules`.
- Default host ports are remapped (Postgres `5544`, Redis `6390`) to avoid clashing with a
  locally-installed Postgres/Redis. Change them in `.env` if needed.
