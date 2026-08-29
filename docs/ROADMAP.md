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
| M8 | Polish, tests, docs, seed, deployment | ✅ |
| M9 | SaaS subscription plan gating + 14-day trial (no payment provider) | ✅ |

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

## ✅ M8 — Polish, tests, docs, seed, deployment

UX/deps polish, expanded pure-logic test coverage, docs/status updates, an idempotent demo seed,
and Docker self-hosting.

- **Deployment:** multi-stage `Dockerfile` (Bun hoisted install, Prisma client generate, API runs
  from TS source, web is `next build` + `next start`) and `docker-compose.prod.yml` for a single
  host (postgres + redis internal-only, api :3001, web :80). Same-origin or split-origin web/API
  with build-time `NEXT_PUBLIC_API_URL`.
- **Demo seed** (`bun --filter api db:seed`): idempotent "Acme Duka" business + owner login
  `demo@beaver.local` / `demo1234`, products with opening stock, a supplier + goods-received
  purchase, a customer with credit debt, sales across recent days, expenses, and an open till —
  so every screen has realistic data out of the box.
- **Expanded pure-logic tests** (deterministic, no DB/HTTP), extracted from services so the maths
  and branching are unit-tested:
  - `sales/refund.ts` — proportional, tax/discount-aware return refunds, over-return & non-positive
    validation, rounding.
  - `notifications/logic.ts` — low-stock / debt / daily-summary message + severity construction.
  - `packages/shared` `formatMoney` (symbol, locale, symbolless, non-finite safety) and `i18n`
    locale guard + payment-method codes.
  - Plus `members.service` `tempPassword` entropy/format tests.
- **Docs:** README status brought up to date; ROADMAP maintained per milestone.
- `next-env.d.ts` tracks the Next 16 route-types layout.

## ✅ M9 — SaaS subscription plan gating + 14-day trial

Tiered plans with feature gating and soft limits. **No payment provider** — the owner/admin
manually switches plans (payment/billing collection is a later milestone). This milestone
only adds *plan state, feature/limit enforcement and the pricing UI*.

Single source of truth: `packages/shared/src/plans.ts` (plan catalog, feature gating, trial
helpers), unit-tested in `plans.test.ts`.

- **Plans** FREE / BASIC / PRO / BUSINESS. Gated features:
  - `ai` (AI assistant & insights) → BASIC+
  - `financialReports` (financial P&L) → PRO+
  - `paidPaymentMethods` (mobile-money/card/bank) → BASIC+ (cash/credit always free)
  - `branches` (multiple branches) → BUSINESS
- **Soft limit:** `products` cap only (FREE 200 / BASIC 1000 / PRO 5000 / BUSINESS unlimited).
  Deliberately customer-friendly — no member cap, no hard lockouts.
- **14-day trial** modeled as `Business.trialEndsAt` (auto-set on onboarding); while active it
  bypasses all features. No separate TRIAL plan.
- **Plan travels in the JWT/session** (`plan` + `isTrial`); plan changes re-issue the session
  via `AuthService.buildSession`, so enforcement reads `req.user` with no DB hit.
- **API (`apps/api/src/modules/billing/`):** GET `/billing/plans` + `/billing/features` (public),
  GET `/billing/current`, PATCH `/billing/plan`, POST `/billing/trial` (settings/manage).
  Global `PlanFeatureGuard` + `@RequirePlanFeature(...)`; paid-method gate in `SalesService`;
  product soft cap in `ProductsService`.
- **Web:** marketing `/pricing`, owner `/settings/billing` (current plan, product usage meter,
  manual plan change), plan-aware app-shell (free non-trial hides the Assistant nav). Web keeps a
  local `apps/web/src/lib/plans.ts` mirror (Turbopack barrel friction — same rationale as
  `lib/money.ts`).
- **Legal + upgrade UX:** public `/terms` and `/privacy` pages (shared `legal-shell` header/footer,
  linked from the landing & pricing footers); a required consent checkbox on `/register`; and
  action-aware pricing CTAs (`components/plan-cta.tsx`) that show "Your current plan" for the active
  tier and route logged-in users to `/settings/billing` to upgrade (logged-out users go to `/register`).

## ✅ Post-M9 — AI insights → Notifications, chat UI redesign, language toggle

- **AI insights now live in Notifications (auto-sent).** `NotificationsService.generate` is driven
  by `AgentsService.insights` — each deterministic insight (restock alerts, top seller, debtors,
  open-till, slow movers, expense spikes) is persisted as a notification keyed `ai:<type>:<day>`
  (idempotent), deep-linked to its domain screen (`/purchases`, `/customers`, `/cash`, …). The
  daily sales roll-up is kept. `NotificationsModule` imports `AiModule` (no cycle). The Assistant
  page no longer duplicates the insights feed.
- **Assistant page redesigned** to a modern chat UI in Beaver's system palette (not dark): centered
  "AI Chat" hero + subtitle + suggestion chips, header action icons (incognito, history, archive),
  and a bottom rounded composer with paperclip (left) + arrow/send (right). Icons added via the
  `make()` pattern in `ui/icon.tsx` (`Globe02`, `Incognito`, `History`, `Archive01`, `Attachment01`).
- **Functional header actions + attachments** (`apps/web/src/lib/chat-store.ts` backs an in-browser
  `localStorage` store): the incognito icon clears the working thread and stops auto-save (with an
  amber "incognito" banner); history opens a panel of auto-saved conversations to resume or delete;
  archive saves/clears an archive list with restore. The composer's paperclip opens a file picker,
  previews the selected image as a thumbnail, and sends its filename as context in the prompt
  (the chat API is text-only, so no server upload).
- **English (US) / Kiswahili toggle.** New web-side i18n (`apps/web/src/lib/i18n.tsx`) with an
  `I18nProvider` + `useI18n` + a `LanguageToggle` (persisted in `localStorage`). The app shell nav,
  upgrade banner, sign-out, the Assistant page, and the Notifications page all switch instantaneously;
  the API insight *body* text remains English for now (generated server-side).

## ✅ Landing page professional pass

- **Rich social/link previews:** `layout.tsx` now emits full OpenGraph + Twitter metadata
  (`NEXT_PUBLIC_APP_URL`-based `metadataBase`), and a branded 1200×630 OG image is generated
  on-the-fly by `apps/web/src/app/opengraph-image.tsx` via `next/og` (served at `/opengraph-image`).
  WhatsApp/social shares now show a rich card instead of a bare URL.
- **Fresh Unsplash imagery** (free under the Unsplash License) downloaded into `public/`: a new hero
  (`hero-shop.jpg`, checkout/register) and an app-preview (`app-preview.jpg`, retail interior) used
  in a new browser-framed "See it in action" section.
- **New landing sections:** a trust band (14-day trial · no card · English & Kiswahili · any phone —
  verifiable claims only, no fabricated stats), "See it in action", a 3-step "How it works",
  and an FAQ (with `details`/toggle) answering card, free-plan, Kiswahili, receipts and upgrade.
- **Polish:** "Free plan · No card required · 14-day full trial" trust lines near CTAs, a readability
  eyebrow on the hero, and accessible `<summary>`/FAQ markup.
- **Hygiene:** removed dead assets `preview.html`, `beaver-logo.jpg`, `beaver-hero.png` from `public/`.


Test suite grew from 98 → ~130 pure unit tests, all passing alongside typecheck and web lint.
