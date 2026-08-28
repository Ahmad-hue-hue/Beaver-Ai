# Beaver — Roadmap

Milestone-based build. Each milestone is a shippable, tested slice. Money is `Decimal`
end-to-end; every scoped row carries `businessId`; domain writes are atomic. See
[`../CLAUDE.md`](../CLAUDE.md) for the conventions that apply to every milestone.

**Legend:** ✅ done · 🔜 next · ⬜ planned

| # | Milestone | Status |
|---|-----------|--------|
| M0 | Scaffold & infra | ✅ |
| M1 | Auth, tenancy, onboarding, RBAC | ✅ |
| M2 | Products, categories, units, inventory core | ✅ |
| M3 | POS & sales | ✅ |
| M4 | Suppliers, purchases, expenses, cash, full customer debt | ✅ |
| M5 | Analytics, dashboard, reports (+ Redis cache-aside) | ✅ |
| M6 | AI assistant + autonomous agentic layer | ✅ |
| M7 | Notifications, employees, admin, security pass | ✅ |
| M8 | Polish, tests, docs, seed, deployment | ⬜ |

---

## ✅ M0 — Scaffold & infra

Bun-workspaces monorepo (`apps/api`, `apps/web`, `packages/shared`). NestJS + Prisma +
PostgreSQL 18 (Docker, pgvector) + Redis. Health endpoint, Swagger, CI-friendly scripts.
Ports remapped (Postgres 5544, Redis 6390, API 3001, web 3000).

## ✅ M1 — Auth, tenancy, onboarding, RBAC

Register/login (argon2id), JWT access + refresh tokens, global `JwtAuthGuard` with
`@Public()` opt-out, permission-based authorization (roles → permissions in
`packages/shared`), multi-tenant `Business` / `Membership`, onboarding flow, audit log.
Web: login / register / onboarding.

## ✅ M2 — Products, categories, units, inventory core

Products, categories, units; inventory as an immutable movement ledger
(`InventoryMovement` with `balanceAfter`), stock counts, low-stock resolution via raw SQL,
pg_trgm search. Web: live products screen + real dashboard KPIs (products / stock value /
low-stock).

## ✅ M3 — POS & sales

The revenue heart. Models: `Customer` (minimal, with `balance`), `Sale`, `SaleItem`,
`SalePayment`, `Return`, `ReturnItem`; enums `SaleStatus`, `PaymentMethod`.

- **Atomic sale** in one `prisma.$transaction`: sale + items + payments + stock decrements
  (`InventoryService.applyInTx`, type `SALE`) + credit → `Customer.balance` + audit, with an
  idempotency key for safe retries. Snapshots name/cost/price per line for later COGS/profit.
- Split payments; cash overpay → `changeGiven`; `CREDIT` requires a customer and sets
  `balanceDue`. Discounts require the `sales.discount` permission (enforced in the service).
- Void and returns reverse stock (type `RETURN`), reverse credit, and record refunds.
- `GET /sales/summary?period=today` powers the dashboard "Today's sales" KPI.
- Endpoints: `POST /sales`, `GET /sales`, `GET /sales/:id`, `POST /sales/:id/void`,
  `POST /sales/:id/returns`; minimal `customers` module (`GET`/`POST`/`GET :id`).
- Web: `/pos` (search → cart → payment → receipt, print) and `/sales` history. Pure Decimal
  totals unit-tested in `sales/totals.ts`.

## ✅ M4 — Suppliers, purchases, expenses, cash, full customer debt

- **Suppliers** CRUD; **purchases / goods-received** that increase stock via the inventory
  ledger (type `PURCHASE`) and set/adjust cost.
- **Expenses** and **cash sessions** (open/close a till, cash movements, reconciliation).
- **Full customer debt**: customer payments against `balance`, statements, aging buckets
  (M3 only tracks the running `balance`).
- Keep every write atomic and Decimal-safe; reuse the ledger + doc-numbering + audit +
  events patterns from M2/M3.

## ✅ M5 — Analytics, dashboard, reports

Deterministic financial analytics: `analytics` module with `/overview`, `/stats` (revenue,
COGS/profit from `costSnapshot` snapshots, net after expenses, margin), `/trend` (continuous
local-day revenue/COGS/profit series), `/top-products` and `/debtors`. All reads are
**cache-aside via Redis** (`CacheService`), invalidated event-driven by `CacheInvalidationListener`
off the shared `DomainEvents`. Web: Reports screen (P&L period view, revenue bars, top
products, top debtors) and Reports added to the app rail; pure trend/margin math is
unit-tested in `analytics/math.test.ts`.

## ✅ M6 — AI assistant + autonomous agentic layer

`ai` provider abstraction under `common/ai` (interface + Anthropic live client + deterministic
mock factory) selected by config; the app and its tests run with no key. The `modules/ai`
assistant grounds `POST /ai/chat` in a live business snapshot (today's P&L, cash, debt, flags)
and calls the provider. The autonomous layer is **rule-based agents** (`agents.service`) that
proactively surface insights — low stock, slow movers/capital tied up, top seller, debt
concentration, negative till, expense spikes — working identically with or without a key.
Pure insight logic is unit-tested. Web: `/assistant` screen (insights feed + grounded chat)
and the Assistant added to the app rail. pgvector ships in the DB image for later semantic
retrieval but is not yet exercised.

## ✅ M7 — Notifications, employees, admin, security pass

Notifications (low-stock, debts, daily summary), employee management + finer RBAC, admin
surfaces, self-service password reset, and a dedicated security hardening pass.

- API: `notifications` module (list/unread/mark-read/read-all/generate-on-demand), `members`
  module (list/invite/role/suspend/reactivate/remove, owner protected), `audit` query
  endpoint (cursor paged, permission gated) added to the global audit module.
- Permissions: added `NOTIFICATIONS_VIEW` (all roles), `EMPLOYEES_VIEW` (owner/manager);
  `EMPLOYEES_MANAGE`/`SETTINGS_MANAGE`/`AUDIT_VIEW` remain owner-scoped.
- Web: `/notifications` (bell + unread badge in app-shell, daily signal generation), `/team`
  (invite with one-time password, role change, suspend/remove), `/settings` (profile + defaults),
  `/settings/audit` (paged tamper-evident log).
- Security pass: helmet + cookie-parser + CORS already enforced; audit trail on sensitive ops;
  owner-only management enforcement server-side; argon2 for invited accounts.

## ⬜ M8 — Polish, tests, docs, seed, deployment

UX polish, expanded test coverage, docs, demo seed data, and deployment.
