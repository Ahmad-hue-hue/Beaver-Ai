# CLAUDE.md — agent guide for Beaver

Context for any AI agent (or human) picking up this repo. Read this first, then
[`docs/ROADMAP.md`](docs/ROADMAP.md) for milestone scope. High-level product/setup docs
live in [`README.md`](README.md); this file is about **how the code works and the rules
you must not break**.

## What Beaver is

A multi-tenant, AI-powered business operating system for small/medium **Tanzanian retail
shops**: POS, inventory, purchases, suppliers, customers & debt, expenses, cash,
deterministic financial analytics, reporting, plus an AI assistant + autonomous "study the
business" agents. Bilingual (English + Kiswahili), mobile-first PWA.

**Status: M0–M3 complete** (infra, auth/tenancy/RBAC, products/inventory, POS & sales).
Next is **M4**. See the roadmap for what each milestone owns.

## Layout

```
apps/api          NestJS backend — one module per domain under src/modules/
apps/web          Next.js 16 App Router PWA (Tailwind v4, shadcn/ui, Hugeicons)
packages/shared   Money, roles, permissions, i18n (TS)
infra/postgres    DB init (extensions)
docker-compose.yml
```

API modules present: `auth, businesses, categories, units, products, inventory,
customers, sales, health`. Web routes present: `login, register, onboarding, dashboard,
products, pos, sales`.

## Run it

Follow `README.md` Quick start. Ports are remapped to avoid host clashes: **Postgres
5544, Redis 6390, API 3001, web 3000** (routes under `/api/v1`, Swagger at `/docs`).

Bun is the runtime — use `bun` / `bun x` (not `npm` / `bunx`). Common tasks:

```bash
bun install                         # hoisted linker (bunfig.toml) — required
docker compose up -d                # Postgres + Redis
bun --filter api db:migrate         # Prisma migrations
bun run dev                         # API + web in parallel
bun test                            # all workspace tests
```

**Gotcha:** if `bun run dev` dies with exit 127 / `bun: command not found`, `bun` isn't on
the subshell PATH. Run the underlying command directly, e.g. from `apps/api`:
`PATH="$HOME/.bun/bin:$PATH" bun --watch run src/main.ts`.

There is a seeded owner account for local dev — **ask the maintainer for credentials**, or
just register a new account at `/register` and complete onboarding. (No credentials are
committed to this repo.)

## Non-negotiable conventions

These are load-bearing. Violating them is a bug even if it compiles.

1. **Money is `Decimal` end-to-end — never floats.** Use `Prisma.Decimal` and the helpers
   in `apps/api/src/common/money/`. Decimal columns: money `@db.Decimal(14,2)`, quantity
   `@db.Decimal(14,3)`. The web layer only *formats* — all arithmetic is server-side.
2. **Every business-scoped row carries `businessId`** with an `@@index([businessId])`.
   Every query filters by it.
3. **Tenancy comes from the JWT, never the client.** A `businessId` in a request body is
   ignored; the authoritative one is on the authenticated actor. Never trust client-supplied
   tenant scope.
4. **A global `JwtAuthGuard` protects every route.** New public endpoints need `@Public()`.
   Authorization is permission-based (`@RequirePermissions(...)`); roles map to permissions
   in `packages/shared` — enforce fine-grained checks (e.g. discounts) in the service from
   `actor.permissions`, not in the controller.
5. **Passwords are argon2id** (`argon2.hash(pw, { type: argon2.argon2id })`) — hashes can't
   be read back.
6. **Multi-step domain writes are one atomic `prisma.$transaction`.** A sale writes sale +
   items + payments + stock movements + debt + audit in a single transaction that fully
   rolls back on any failure. Reuse `InventoryService.applyInTx(tx, movement, allowNegative)`
   to move stock inside another module's transaction.
7. **Reuse existing patterns** rather than inventing: doc-numbering (`nextSaleReference`
   mirrors `nextCountReference`), audit via `AuditService.record`, domain events via
   `EventEmitter2` (`common/events/domain-events.ts`), Decimal helper
   `const dec = (v) => new Prisma.Decimal(String(v))`.
  8. **AI is behind a provider abstraction** with a mock fallback — the app runs and tests
   pass with no `OPENROUTER_API_KEY`. Default text/agent model id:
   `minimax/minimax-m3:free` (function-calling capable); if it transiently overloads the
   provider falls back to `AI_FALLBACK_MODEL` (`minimax/minimax-m2.7:free`). When a message
   carries `images[]`, the provider auto-switches to `AI_VISION_MODEL`
   (`minimax/minimax-m3:free`). Free-tier models are heavily rate-limited on OpenRouter, so
   the provider retries transient overloads (3 attempts with backoff) before surfacing a 500.

### Bun / stack gotchas (cost real time)

- Bun must use the **hoisted** linker (`bunfig.toml`); NestJS/Prisma peer deps don't
  resolve under the default isolated linker.
- Under Bun + `emitDecoratorMetadata`, `import type { X }` for any interface used as a
  decorated controller-param type, or it throws at runtime ("Export named X not found").
- Next 16/Turbopack can't resolve the shared package's `.js`-suffixed barrel re-exports.
  The web app keeps a local `apps/web/src/lib/money.ts` instead of importing `@beaver/shared`.
- `noUncheckedIndexedAccess` is on — guard array/index access.
- Column-to-column filters (e.g. `stock <= reorderLevel`) aren't expressible in Prisma
  `where`; resolve ids via `$queryRaw` first.
- Any `CREATE EXTENSION` (pg_trgm/unaccent/vector) must live in the migration that precedes
  its use, or Prisma's shadow DB fails `migrate dev`.
- `prisma migrate reset` wipes data and is blocked for AI agents unless the user gives fresh
  explicit consent — never run it without that.

## Frontend conventions

Minimalist, **not** generic "AI-slop". Palette: **green (`#039855` / brand scale) + slate +
white**. **Avoid boxes/cards** — prefer whitespace, alignment, and hairline dividers
(`--color-hairline`). Large tap targets for POS on Android (`.tap`). Design tokens live in
`apps/web/src/app/globals.css` `@theme`.

- **Icons: Hugeicons** via the lucide-compatible wrapper `apps/web/src/components/ui/icon.tsx`
  (named exports render `<HugeiconsIcon>`, inherit `currentColor` + `size-*`). Swap the
  library in that one file — screens keep the `<Icon className="size-6" />` shape.
- Type: **General Sans** (UI) with **tabular numerals** for money; **JetBrains Mono** for
  eyebrows/IDs/receipts.
- UI is built from **shadcn/ui + 21st.dev** templates — customize existing high-quality
  templates; don't generate bespoke component CSS from scratch.
- Responsive: mobile bottom-nav vs desktop rail; POS uses a bottom-sheet cart on phones.

## Security

- **Never commit secrets.** `.env` / `apps/api/.env` are gitignored; only `.env.example`
  (placeholders + local dev defaults) is tracked. Verify with `git ls-files | grep env`
  before any push.
- Don't put real API keys, JWT secrets, DB passwords, or account passwords in tracked files,
  commits, or docs.
```
