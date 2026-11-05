# VSA Commerce API: 1-Year Online Ballet Club

A backend commerce and data foundation for one real product: **Victory Skating Academy's
"1-Year Online Ballet Club"**. It turns business-approved product information into
structured commerce data that an AI assistant can later query safely.

> **Phase 1** (commerce domain) intentionally contains no LLM. It has to work deterministically,
> and be tested, before any AI layer is allowed to call it.
> **Phase 2** adds an AI action layer (`src/ai`, `POST /ai/chat`) on top. The LLM only converses;
> every fact still comes from the Phase 1 services. See [§16](#16-ai-layer-phase-2).
> **Phase 3** adds a Next.js demo frontend (`web/`) that calls the real API. See [§18](#18-demo-frontend-nextjs).

---

## Reviewer quick start

**What it is.** A grounded AI commerce prototype for one real product. An LLM (OpenAI tool
calling) answers customer questions, but every fact comes from a tested NestJS + PostgreSQL commerce
layer with provenance. Unknowns stay unknown, and payment is only offered when the checkout is
verifiably consistent. Today it is **blocked**, because the captured checkout ($179/year)
conflicts with the published offer ($499 package total).

**Run it** (Node ≥ 20, pnpm via `corepack enable`, Docker):

```bash
cp .env.example .env                  # add OPENAI_API_KEY (everything except /ai/chat works without it)
cp web/.env.example web/.env.local
pnpm install                          # root + web (pnpm workspace)
docker compose up -d --wait           # PostgreSQL 16 on localhost:5434
pnpm db:migrate && pnpm db:seed
pnpm build && pnpm start              # API  → http://localhost:3001
pnpm --dir web build && pnpm --dir web start   # UI → http://localhost:3002 (second terminal)
```

**Demo walkthrough (about 3 minutes):**
1. Look at the "before" first: [`docs/baseline/`](docs/baseline/README.md) has signed-out Gemini
   Flash-Lite answers to the same questions. It mixes products, says Sunday instead of Saturday,
   calls $499 "per year", explains $179 as a promotion, and walks the user to payment.
2. In the UI, click *"I'm a beginner looking for online ballet classes for a year."* The product
   panel fills from the API: name, $499 package total, Saturdays, 48 × 60 min, audience.
3. Ask *"Can I join around November 6, 2026?"* A date-check card shows Friday (not a class day),
   the next **candidate** Saturday November 7 in your timezone, and that exceptions aren't
   confirmed. Enrollment shows "Open*" (prototype configuration, not confirmed by VSA).
4. Ask *"How do I enroll and pay?"* Payment shows **Verification required** with a disabled
   button. "View details" compares $499 package total against the captured $179/year, and no
   checkout URL reaches the browser.
5. Click **Show trace** to see the tool calls with validated arguments and the transaction-safety
   state (Blocked · `PRICE_CONFLICT`, URL captured but withheld).

**Verify:**

```bash
pnpm typecheck && pnpm lint && pnpm test          # backend unit tests (OpenAI mocked)
pnpm test:e2e                                     # backend e2e against the real DB (migrate + seed first)
pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test && pnpm --dir web build
pnpm eval:ai -- --out docs/after/run-YYYY-MM-DD.md   # optional live OpenAI evaluation
```

**Where to look:**

| Topic | Section |
|---|---|
| Architecture | [§3](#3-architecture), [§16 AI layer](#16-ai-layer-phase-2), [§18 frontend](#18-demo-frontend-nextjs) |
| REST API | [§10](#10-api) |
| AI tools, policy and actions | [§16](#16-ai-layer-phase-2) |
| Transaction safety | [§17](#17-captured-checkout-and-transaction-safety) |
| Known limitations | [§14](#14-limitations) |
| Before vs after | [`docs/baseline/`](docs/baseline/README.md) → [`docs/after/`](docs/after/README.md) |

---

## 1. Purpose

AI assistants answering commerce questions ("How much is it?", "Can I join on Nov 6?",
"Is it for beginners?") tend to mix products, invent schedules and holidays, quote stale
promotional dates, and present conflicting marketing claims as fact. This service is the
**single, structured source of truth** they will call instead. Every important value comes
with its provenance, and anything unknown, unconfirmed or conflicting is represented
explicitly instead of being guessed.

## 2. Scope

**In scope:** NestJS modular monolith, normalised PostgreSQL schema (Drizzle ORM), migrations,
an idempotent seed for the annual ballet program, read-only REST endpoints, validation, and
unit plus e2e tests.

**Phase 2 adds:** an OpenAI tool-calling conversation layer inside the same monolith (§16).

**Phase 3 adds:** a single-page Next.js demo frontend over the same API (§18).

**Out of scope (by design):** authentication, embeddings, vector search, RAG, MCP,
agent frameworks, scraping, payments, queues, microservices, generic CMS.

## 3. Architecture

```
src/
├── common/            enums (single source of truth), provenance types, lookup keys, validators, clock
├── config/            env validation
├── database/
│   ├── schema/        Drizzle tables + Postgres enums + provenance column helper
│   ├── migrate.ts     applies SQL migrations from ./drizzle
│   └── seed/          typed seed data (vsa-annual-ballet.data.ts) + idempotent seed script
├── business/          GET /businesses/:slug         (slug, canonical name or alias)
├── product/           GET /products, /products/:slug (offer, program, coaches, access, requirements)
│   └── domain/        access-policy.ts, price-claim.ts          ← pure functions
├── schedule/          GET /products/:slug/schedule
│   └── domain/        evaluate-date.ts (recurrence, exceptions, IANA/DST) ← pure
├── enrollment/        GET /products/:slug/enrollment
│   └── domain/        resolve-availability.ts                   ← pure
├── checkout/          GET /products/:slug/checkout   (external hand-off only)
├── data-quality/      GET /products/:slug/data-quality
│   └── domain/        issue-evidence.ts (DERIVED evidence)      ← pure
├── availability/      GET /products/:slug/date-check (composes enrollment + schedule, never merges them)
└── ai/                POST /ai/chat: OpenAI tool calling over the services above (Phase 2)
    ├── tools/         search_products, get_product, check_date, get_enrollment, get_checkout + executor
    ├── domain/        grounding-policy.ts (rules, URL redaction), actions.ts (UI actions from tool results)
    └── prompt/        system-prompt.ts (behaviour only; no business data)

web/                   Next.js demo UI (§18): chat, product / enrollment / payment panels, technical trace
scripts/eval-ai.ts     optional live OpenAI evaluation (pnpm eval:ai)
docs/                  baseline/ (Gemini), after/ (live runs), demo/ (screenshots), evidence/ (checkout capture)
```

There are three layers in each module:

- **Repository:** the only code that touches Drizzle.
- **Service:** maps rows to domain-oriented response DTOs, so raw rows never leave the service.
- **Domain:** pure functions with no Nest or DB dependencies, unit-tested directly.

## 4. Why normalised commerce data instead of facts in an LLM prompt

- **Single source of truth.** Price, schedule and enrollment state live in the database.
  Changing them is a data change, not a prompt edit, and every assistant sees the same values.
- **Determinism and testability.** "Is 2026-11-06 a class day?" is computed by tested code,
  not left to the model.
- **Provenance travels with the data.** A prompt cannot reliably carry "this is confirmed,
  that is an assumption". Structured responses can.
- **Isolation.** Every product-owned row has a `product_id` FK, so the annual group program
  cannot be mixed with private lessons or monthly plans. The e2e suite proves this with a
  temporary private-lesson product.
- **Conflicts are quarantined.** Contradictory source claims (e.g. "$3/class") are stored as
  data-quality issues and are never mixed into commerce fields.

## 5. Domain separation

| Concept | Table | Determined by | Never inferred from |
|---|---|---|---|
| **Enrollment** | `enrollment_availability` | configured windows (`OPEN/CLOSED/UNKNOWN`, optional dates) | schedule, checkout link, promotional dates |
| **Schedule** | `schedules`, `schedule_exceptions` | weekly rule + explicitly stored exceptions | enrollment, promotional dates |
| **Access** | `access_policies` | duration + start rule + end rule, each verified separately | purchase date (never calculated) |
| **Checkout** | `checkout_actions` | external URL + status + verification + blocking data-quality issues (§17) | n/a; it implies nothing about enrollment, and a captured URL is not an approved checkout |

`resolveAvailability()` takes no schedule, checkout or promotional input. `evaluateDate()` takes
no enrollment input. A unit test proves the separation: switching enrollment from OPEN to CLOSED
leaves the schedule output byte-identical, and changing exceptions leaves the enrollment output
identical.

## 6. Provenance model

Each important fact carries one lightweight provenance group:

```ts
{ sourceType, sourceRef, verificationStatus, verifiedAt }
```

| `sourceType` | Meaning |
|---|---|
| `LANDING_PAGE` | Captured directly from the landing page. **Nothing uses this yet**, because the page has not been captured. |
| `ASSIGNMENT_BRIEF` | Supplied through the assignment brief (even if the brief says it is on the landing page). |
| `BUSINESS_APPROVED_CONFIG` | Operational value explicitly approved by VSA. |
| `PROTOTYPE_CONFIG` | Operational value set by the project team for the demo; **not** approved by VSA. |
| `MANUAL_CHECKOUT_VERIFICATION` | What an external checkout page displayed when a person opened it. It confirms what the checkout shows, **not** which commercial terms the business intends. |
| `DERIVED` | Computed by this system. Never stored; only appears inside data-quality `evidence`, tagged `isPublishedFact: false`. |

`verificationStatus` is one of `CONFIRMED | UNCONFIRMED | CONFLICTING | UNKNOWN`.

Provenance is tracked per row by default, and per field where one row mixes confirmed and
unknown facts: `schedules.tz_*` (timezone), `schedules.exceptions_*` (exception coverage), and
`access_policies.duration_* / start_rule_* / end_rule_*`. Each group is four columns, generated
by `provenanceColumns(prefix)`, so there is no generic provenance framework.

## 7. Known, unknown and conflicting information (seed)

| Fact | Value | Source | Status |
|---|---|---|---|
| Business / aliases | Victory Skating Academy; "Victory Skating", "VSA" | ASSIGNMENT_BRIEF | CONFIRMED |
| Product | GROUP_PROGRAM · BALLET · ONLINE_LIVE | ASSIGNMENT_BRIEF | CONFIRMED |
| Audience | BEGINNER, RECREATIONAL, ADVANCED, PROFESSIONAL | ASSIGNMENT_BRIEF | CONFIRMED |
| Program | 12 months · 48 classes · 60 min | ASSIGNMENT_BRIEF | CONFIRMED |
| Coach | Emilia (LEAD) | ASSIGNMENT_BRIEF | CONFIRMED |
| Offer | **$499 USD, PACKAGE_TOTAL** | ASSIGNMENT_BRIEF (reported as published) | CONFIRMED |
| Payment schedule | UNKNOWN (not inferred) | — | UNKNOWN |
| Recurrence | Weekly, Saturday, 11:00, 60 min | ASSIGNMENT_BRIEF | CONFIRMED |
| Canonical timezone | America/Los_Angeles | ASSIGNMENT_BRIEF (modelling assumption from "PDT" label) | **UNCONFIRMED** |
| Schedule exceptions | none provided; coverage `null` | — | UNKNOWN |
| Enrollment | OPEN, open-ended | **PROTOTYPE_CONFIG** | **UNCONFIRMED** |
| Access duration | 12 months | ASSIGNMENT_BRIEF | CONFIRMED |
| Access start / end rule | UNKNOWN | — | UNKNOWN |
| Requirements | none provided (`NOT_PROVIDED`) | — | — |
| Checkout | Stripe checkout **captured**; observed $179/year, billed annually; `usable: false`, URL withheld | MANUAL_CHECKOUT_VERIFICATION | **CONFLICTING** (see §17) |

Not seeded on purpose: the landing page's "monthly flat fee" wording and its advertised start
date. Their exact wording and values haven't been captured, so they would have to be invented.
The schema supports both as data-quality issues.

## 8. Schedule and timezone handling

- One canonical rule: `WEEKLY · SATURDAY · 11:00 · America/Los_Angeles · 60 min`. The four
  published strings (`11:00–12:00 PDT`, `14:00–15:00 EDT`, `19:00–20:00 UK`, `20:00–21:00 CEST`)
  are stored as **evidence** in `published_time_labels` and are never used as conversion rules.
- Every occurrence is converted with IANA rules (Luxon) for that specific date. The labels hold
  only while both the US and Europe are on summer time. For example:

  | Saturday | Los Angeles | New York | London | Berlin | UTC |
  |---|---|---|---|---|---|
  | 2026-07-11 | 11:00 PDT | 14:00 EDT | 19:00 BST | 20:00 CEST | 18:00 |
  | 2026-10-31 | 11:00 PDT | 14:00 EDT | **18:00 GMT** | **19:00 CET** | 18:00 |
  | 2026-11-07 | 11:00 PST | 14:00 EST | 19:00 GMT | 20:00 CET | 19:00 |

- Each occurrence has a status:

  | Status | Meaning |
  |---|---|
  | `SCHEDULED_CONFIRMED` | On or before `exceptions_confirmed_through`, with no exception stored |
  | `CANDIDATE_UNCONFIRMED` | Matches the rule, but exception data for that date is unknown |
  | `CANCELLED` / `RESCHEDULED` / `ADDITIONAL` | Comes from a stored exception (each carries its own verification status) |

- **An empty exception list means "none provided to this prototype", not "there are no
  exceptions".** The API says so explicitly (`exceptions.knowledge.status = NOT_PROVIDED`).
- **48 classes vs ~52 Saturdays:** both facts are kept. The skipped Saturdays are unknown and
  are never invented; this is recorded as an AMBIGUOUS data-quality issue, not an error.
- **Calendar dates:** a requested `date` is read in the schedule timezone, or in `tz` if the
  caller passes it. Saturday 11:00 in Los Angeles is Sunday 04:00 in Tokyo, so
  `date=2026-11-08&tz=Asia/Tokyo` matches the recurrence. An invalid `tz` returns 400; there is
  no silent fallback.
- **Promotional dates** have no column in the enrollment, schedule or access tables, so they
  cannot close enrollment, set access dates or start the recurrence.

## 9. Data-quality behaviour

`data_quality_issues` stores source claims that are `CONFLICTING`, `AMBIGUOUS`, `MISSING`,
`UNVERIFIED` or `OUTDATED`, together with the raw claim and its source. They are exposed only
through `/data-quality`, always with `exposedAsCommerceData: false`.

For `"$3/class"`, the API attaches read-time evidence:
`derivedPricePerIncludedClass = $10.40` ($499 / 48), tagged `sourceType: DERIVED`,
`isPublishedFact: false`, with verdict `CONFLICTING`. The derived figure never appears on the
offer.

## 10. API

| Method & path | Query | Notes |
|---|---|---|
| `GET /businesses/:slug` | — | Accepts slug, canonical name or alias (`/businesses/VSA`) |
| `GET /products` | `business, discipline, deliveryMode, level, durationMonths, q` | `business` accepts aliases; enum filters are case-insensitive; response includes `businessResolution` |
| `GET /products/:slug` | — | Offer, program, coaches, audience, access policy (confirmed duration vs unknown rules), requirements knowledge |
| `GET /products/:slug/schedule` | `date?, tz?` | Recurrence, exception knowledge, requested-date match, next candidate occurrences |
| `GET /products/:slug/enrollment` | `date?` | Status, window, basis, provenance, `independentOf` |
| `GET /products/:slug/checkout` | — | External checkout hand-off: `urlCaptured`, `usable`, `blockingIssues`, `verification`, `observedTerms`. The URL is only returned when usable. |
| `GET /products/:slug/data-quality` | — | Issues with raw claims, sources, DERIVED evidence |
| `GET /products/:slug/date-check` | `date` (required), `tz?` | `{ product, enrollment, requestedDate, schedule, nextCandidateOccurrences, limitations }`. There is deliberately no single `available` boolean. |

| `POST /ai/chat` | body `{ message, timezone?, history? }` | Phase 2 conversation endpoint (§16) |

Errors: unknown product or business → **404**. Invalid date, timezone or enum filter, or an
unknown query parameter → **400**.

Example: "I'm free on November 6, 2026. Can I join around that time?"

```
GET /products/1-year-online-ballet-club/date-check?date=2026-11-06
```

The response gives three separate answers:

- **Enrollment:** `OPEN`, from `PROTOTYPE_CONFIG`, `UNCONFIRMED`.
- **Requested date:** `FRIDAY`, `matchesRecurrence: false`.
- **Next candidate:** `2026-11-07`, 19:00 UTC (11:00 PST / 14:00 EST / 19:00 GMT / 20:00 CET),
  status `CANDIDATE_UNCONFIRMED`.

It also returns `limitations` that tell an assistant what it must not overstate.

## 11. Local setup

Requirements: Node ≥ 20 (tested on 22), pnpm (via `corepack enable`), Docker.

```bash
cp .env.example .env
pnpm install
docker compose up -d --wait        # PostgreSQL 16 on localhost:5434
pnpm db:migrate
pnpm db:seed
pnpm build && pnpm start           # http://localhost:3001
# or: pnpm start:dev
```

The default ports are **5434** (Postgres) and **3001** (API), chosen to avoid the common
5432/3000. Change them in `.env`.

## 12. Database commands

| Command | Purpose |
|---|---|
| `pnpm db:generate` | Generate a new SQL migration from `src/database/schema` (drizzle-kit) |
| `pnpm db:migrate` | Apply migrations in `./drizzle` |
| `pnpm db:seed` | Idempotently (re)seed VSA in one transaction (delete business → cascade → re-insert) |

## 13. Tests

```bash
pnpm test        # unit tests: pure domain, mapping, DTO validation, seed invariants, separation, AI layer (mocked OpenAI)
pnpm test:e2e    # HTTP + real DB (run db:migrate and db:seed first); AI e2e uses a scripted OpenAI mock
pnpm lint
pnpm eval:ai     # optional, live OpenAI; NOT part of tests (§16)
```

Coverage highlights:

- `evaluateDate`: 2026-11-06 → Friday / next 2026-11-07; DST on 07-11, 10-31 and 11-07;
  viewer timezone; exceptions; unknown timezone.
- `resolveAvailability`, `checkPerClassPriceClaim` ($499/48 vs "$3/class"), `summarizeAccessPolicy`.
- Enrollment/schedule separation both ways.
- Alias resolution and product isolation against the real database (e2e).

## 14. Limitations

- Facts come from the assignment brief. The landing page has not been captured, so nothing is
  `LANDING_PAGE`-verified.
- The canonical timezone (America/Los_Angeles) is an unconfirmed assumption. If VSA actually
  anchors the class to UK or CET time, the times shown during the DST gap weeks will be wrong.
- Enrollment `OPEN` is demo configuration only.
- The checkout was captured manually once (2026-10-03). It conflicts with the published offer and
  is blocked, so the prototype never offers a working payment path. Nothing re-verifies it automatically.
- The payment schedule and the access start/end rules are unknown.
- Zero requirement rows can mean "not provided" but cannot yet express "confirmed none".
- "Today" for enrollment is evaluated in UTC.
- `q` is a simple substring match. Turning intent into a query ("year-long ballet from home")
  is left to the future AI layer, which should map it onto the structured filters
  (`durationMonths=12`, `deliveryMode=ONLINE_LIVE`, `discipline=BALLET`, `level=BEGINNER`).
- One schedule per product (unique constraint), which is enough for this program.
- No admin/write API; data changes go through the seed or SQL.
- **AI layer:** answers are non-deterministic. gpt-5-mini sometimes still uses internal wording
  ("authoritative", "configuration") or restates the $499 package total as "per year" despite the
  prompt rules. The structured panels and actions are always built from API data, so they stay
  correct even when the prose isn't. There is no server-side memory; history is sent by the client.
- **Frontend:** a demo for one product, with no authentication. API types are mirrored by hand
  (`web/src/lib/api/types.ts`).
- **Baseline:** the Gemini baseline is a set of screenshots, and at least one query (X1) was
  asked in a continued thread (see `docs/baseline/README.md`).

## 15. What's next

1. ~~**AI tool layer**~~: done in Phase 2 (§16).
2. ~~**Connected assistant UI**~~: done as the demo frontend (§18).
3. **Checkout URL capture and verification:** capture the production URL, verify it
   periodically, update `status` / `verified_at`.
4. **Landing-page capture:** move facts from `ASSIGNMENT_BRIEF` to `LANDING_PAGE` with capture
   timestamps; add the monthly-fee and promo-date issues once their wording is captured.
5. **Admin/configuration UI:** let VSA approve values (`BUSINESS_APPROVED_CONFIG`), manage
   exceptions and coverage, and resolve data-quality issues.
6. **Sync/connectors:** pull from VSA's actual commerce system of record.
7. **Conversion tracking:** attribute assistant-driven checkout hand-offs.

See `docs/baseline/` for the baseline-vs-after evaluation protocol.

---

## 16. AI layer (Phase 2)

### The LLM is not the source of truth

The model is a reasoning and conversation layer only. Prices, class counts, schedule, coach,
audience, enrollment state, access rules, requirements and checkout all come from the Phase 1
services at request time. The system prompt (`src/ai/prompt/system-prompt.ts`) contains
**behavioural rules only**. A unit test (`system-prompt.spec.ts`) fails if any seeded commerce
value appears in the prompt or the tool definitions: the business name or aliases, product
name, coach, price, class count, weekday, timezone, published times, URL, "$3" or "10.40".

### Architecture

```
POST /ai/chat ─▶ AiService ─▶ OpenAI Chat Completions (tools)
                    ▲  │ tool_calls
                    │  ▼
                    │ ToolExecutor ── validates args (class-validator DTOs, same rules as REST)
                    │  │
                    │  ▼  in-process DI calls, no HTTP back to localhost
                    │ ProductService · DateCheckService · EnrollmentService · CheckoutService · DataQualityService
                    │  │
                    └──┘ structured results with provenance, fed back to the model
                    ▼
     { message, actions (built by backend code), toolTrace, meta }
```

| Tool | Calls | Use |
|---|---|---|
| `search_products` | `ProductService.list` + `resolveSearch()` | Intent → structured filters (`business` alias, `discipline`, `deliveryMode`, `level`, `durationMonths`, `q`). Adds a deterministic `resolution` hint (single match, multiple matches, or no match) with the next step to take. |
| `get_product` | `ProductService.detail` + `ScheduleService` (rule only) + open `DataQualityService` issues | Authoritative product facts, the recurring schedule rule and exception knowledge (no computed dates), plus `dataQualityWarnings`. REST navigation `links` are dropped. |
| `check_date` | `DateCheckService.check` | Any date question; enrollment and schedule stay separate sections. `timezone` defaults to the request's timezone. |
| `get_enrollment` | `EnrollmentService.getForSlug` | Enrollment without date reasoning |
| `get_checkout` | `CheckoutService.getForSlug` | External checkout hand-off |

**Loop.** Multi-step tool calling, with several calls per turn allowed. There are at most
`AI_MAX_TOOL_ITERATIONS` (default 6) model round trips and 16 tool calls per request; after
that, a safe fallback message is returned with `meta.stoppedReason = MAX_TOOL_ITERATIONS`.

**Errors.**
- Invalid or malformed tool arguments → `INVALID_ARGUMENTS`.
- Unknown slug → `NOT_FOUND`.
- Unexpected failures → `TOOL_FAILED` with a generic message.

All of these go back to the model as structured tool results; none of them crash the request.
OpenAI failures → 502. No API key → 503. The rest of the API keeps working without a key.

**Data-quality decision.** Instead of adding a sixth tool, `get_product` returns the product's
OPEN data-quality warnings next to the authoritative data. Whenever the model looks at the
product, it sees conflicting claims such as "$3/class" together with their DERIVED evidence,
so it doesn't need to remember a separate tool. The REST `/products/:slug` response is unchanged.

### Policy (summary of `src/ai/domain/grounding-policy.ts`)

The policy is generic, grouped by concern, and contains no business facts or product-specific
special cases:

| Section | Gist |
|---|---|
| Grounding | Facts only from tool results; never fill gaps from general knowledge |
| Product resolution | Don't ask "which product?" first. Search with only the signals the user gave (possibly none). If exactly one product matches, continue with it; clarify only when several materially different products remain; reuse products established earlier in the conversation. |
| Tool arguments | Set a filter only if the user stated it, earlier conversation established it, or a tool returned it. Normalising is fine ("from home" → online); guessing is not. Use the fewest calls: one match → `get_product`; no match → one broader retry, then stop. |
| Separate concepts | Enrollment, schedule, access and checkout are separate; dates via `check_date`; never guarantee unconfirmed occurrences |
| Prices and claims | Prices only from offers; no payment schedule unless known; DERIVED values are never prices; CONFLICTING claims are never confirmed; a warning doesn't downgrade the confirmed fields around it |
| Actionability | Join/enroll/sign-up intent → resolve → enrollment (or `check_date`) → `get_checkout` in the same turn. Informational questions don't call checkout. |
| Presentation | Customer language. No codes, field names, slugs or tool names in prose; statuses written as normal words while keeping the uncertainty. Never restate a package total as a per-period price, never volunteer derived unit prices, and never promise monitoring, notifications or follow-up. |

There is also a code-level backstop: `redactUngroundedUrls()` replaces any URL in the model's
text with `[link removed]` unless it is the URL of a backend-built CHECKOUT action.

### Product resolution and conversation context

- Every response carries `context.productSlugs`: products grounded by successful tool calls
  in this turn, plus those carried over from earlier turns (most recent last, at most 5).
- The client sends them back on the assistant's history entry (`history[].productSlugs`).
  The backend then tells the model which products are already identified, so "Is it $3 per
  class?" goes straight to `get_product` without a new search.
- There is still no server-side memory.
- The slugs are format-validated, untrusted hints; the tools still verify the product exists.

### Actions

The frontend never has to parse prose. Actions are derived by `buildActions()` from successful
tool results, never from model text:

| Type | Built when | Fields |
|---|---|---|
| `VIEW_PRODUCT` | `get_product` succeeded | `label`, `productSlug`, `apiPath` |
| `CHECKOUT` | `get_checkout` returned `usable === true`, **no** `blockingIssues` **and** a non-null http(s) `url` | `label` (from the offer, e.g. "Enroll — $499.00"), `url`, `productSlug`, `offer`, `systemOfRecord` |
| `CHECKOUT_UNAVAILABLE` | `get_checkout` returned a checkout that isn't usable | `label`, `productSlug`, `reasons[] { code, message }` (e.g. `PRICE_CONFLICT`). Never carries a URL. |

With the current data (checkout captured but blocked by `PRICE_CONFLICT`), **no CHECKOUT action is
ever returned**, whatever the model says or asks for.

### Chat API

```http
POST /ai/chat
{ "message": "I'm free on November 6, 2026. Can I join?", "timezone": "Europe/London",
  "history": [{ "role": "user", "content": "..." }, { "role": "assistant", "content": "..." }] }
```

- **History context:** an assistant entry may include `productSlugs` (at most 5 kebab-case slugs), echoed from that turn's `context.productSlugs`.
- **Request limits:** `message` ≤ 2000 characters; `timezone` must be a valid IANA zone;
  `history` is optional, has at most 20 entries, and only allows `user` and `assistant` roles.
- **Persistence:** nothing is stored server-side.
- **Response:**
  - `message`
  - `actions`
  - `context`: `{ productSlugs }`, to echo back in history
  - `toolTrace`: each entry has `tool`, `success`, `durationMs`, the validated `arguments` and
    `errorCode`. Raw tool payloads and prompts are never included.
  - `meta`: `model`, `iterations`, `stoppedReason`.

### Configuration

| Variable | Default | |
|---|---|---|
| `OPENAI_API_KEY` | empty | Required for `/ai/chat` (503 without it). Never logged. |
| `OPENAI_MODEL` | `gpt-5-mini` (defined only in `src/ai/ai.config.ts`) | Any Chat Completions model with tool calling |
| `AI_MAX_TOOL_ITERATIONS` | 6 | 1–10 |

### Baseline vs connected prototype

- **Gemini baseline** (`docs/baseline/`): signed-out Google Gemini Flash-Lite, 2026-10-04.
  Answers come from general knowledge and web results, with no structured data, no provenance and
  no guarantees.
- **Connected prototype** (`docs/after/`): the same queries, but every product fact comes from
  tool calls into this commerce layer, unknowns stay unknown, and actions are built by backend code.

### Optional live evaluation

```bash
# needs OPENAI_API_KEY in .env, plus a migrated and seeded DB
pnpm eval:ai                                          # prints answers, tools, actions, audits, summary
pnpm eval:ai -- --out docs/after/run-YYYY-MM-DD.md    # also writes a verbatim markdown report
```

- **Section 1:** nine independent queries (the six baseline queries plus Nov 6, equipment, and "$3 per class").
- **Section 2:** a five-turn conversation that passes history, including `productSlugs`, between turns.
- **Automated heuristics per turn:**
  - *internal terms in prose* (`findInternalTerms`): raw codes, field names or tool names;
  - *ungrounded tool arguments* (`auditToolArguments`): search filters with no cue in the conversation.

  These are indicators, not proof; the responses still need to be read.
- Not part of `pnpm test` or CI. Without a key it prints `SKIPPED`.

Live results so far, all gpt-5-mini (reports in `docs/after/`):

| Metric | v1 | v2 | v3 |
|---|---|---|---|
| Turns with raw codes in prose (heuristic) | 7 of 9 | 3 of 14 | 4 of 14 |
| Raw-code occurrences | 79 | 4 | 4 |
| B5 tool calls | 6 | 3 | 4 |
| Ambiguous X2 / X3 resolved | no / no | yes / yes | yes / yes |
| Ungrounded search filters (heuristic) | `IN_PERSON` in B6 | none | none |

Run-to-run variance is visible (B5: 3 calls in v2, 4 in v3).

Later runs: v4 (2026-10-03) added the blocked-checkout queries; v5 (2026-10-04, concise presentation
rules) had internal terms in 0 of 16 turns and leaked the blocked checkout URL in 0 of 16. The Gemini
before/after comparison is in [`docs/after/README.md`](docs/after/README.md).

### Testing approach

- **Unit tests** (OpenAI fully mocked) also cover product resolution (single / multiple / no
  match), history product reuse, the join → enrollment → checkout flow, leak detection and the
  argument audit. They cover:
  - tool dispatch, invalid arguments and domain-error conversion;
  - the multi-tool loop, the max-iteration and tool-call caps;
  - actions: no CHECKOUT action while the URL is null, and the URL comes only from domain data;
  - URL redaction, a secret-free trace, a prompt with no facts, and request validation.
- **E2E** (`test/ai.e2e-spec.ts`): the full HTTP stack with real services and the real database,
  with only the OpenAI client replaced by a scripted mock.
- These prove the plumbing, not the model's behaviour. Live behaviour can only be judged with
  `pnpm eval:ai`.

---

## 17. Captured checkout and transaction safety

On 2026-10-03 the real checkout linked from the program was opened manually. It is a VSA
Stripe-hosted checkout for "1-Year Ballet Club (weekly classes)" showing **$179 USD per year,
billed annually**. The authoritative offer is **$499 USD, package total**. The business has not
explained the difference, so it is modelled as an unresolved material conflict. The evidence and
screenshot are in [`docs/evidence/checkout/`](docs/evidence/checkout/README.md).

**Model (small additions to existing tables):**
- `checkout_actions` gains `provider` and `observed_*` columns: merchant, product label, amount,
  currency, billing, verbatim terms text and `observed_at`.
- Its provenance is `MANUAL_CHECKOUT_VERIFICATION` and `CONFLICTING`.
- `status = ACTIVE` means only that the page was live at the provider.
- The authoritative offer is **unchanged**: $499, package total, payment schedule UNKNOWN.
- `data_quality_issues` gains a nullable `blocking_code`. The new OPEN issue `checkout.price`
  (CONFLICTING) carries `PRICE_CONFLICT`.
- The earlier `checkout.externalUrl` MISSING issue is now `RESOLVED`.

**Eligibility.** `evaluateCheckoutEligibility()` (pure function, unit-tested) requires all of:
- a captured URL;
- `status = ACTIVE`;
- verification not CONFLICTING;
- no OPEN issue with a blocking code.

Each failure becomes a machine-readable `blockingIssues[]` entry: `URL_NOT_CAPTURED`,
`CHECKOUT_NOT_ACTIVE`, `CHECKOUT_TERMS_CONFLICTING` or `PRICE_CONFLICT`.

**No URL while blocked.**
- The raw URL is stored, but every API representation returns `url: null` and
  `urlWithheld: true` until the checkout is usable.
- REST and the AI tools share that representation, so the model never receives the URL.
- If the model writes the URL from memory, `redactUngroundedUrls()` removes it.
- `buildActions()` re-checks `usable`, `blockingIssues` and the URL itself as a second check.

**Evidence vs derivation.** In `/data-quality`, the observed $179 is source evidence
(`MANUAL_CHECKOUT_VERIFICATION`) and the $499 keeps its own source type. Only the comparison
(`amountsMatch: false`, `resolution: UNRESOLVED`) is `DERIVED`.

**AI prompt.** Two generic rules were added and nothing specific to this conflict:
- never offer payment, a link or a workaround when checkout isn't usable;
- present conflicting commercial terms as conflicting sources, without choosing between them.

A test fails if `$179`, `Stripe`, the URL or the checkout label appears in the prompt.

---

## 18. Demo frontend (Next.js)

A single-page demo UI in [`web/`](web/) (Next.js 16, React 19, TypeScript, Tailwind CSS 4). It
calls the real NestJS API. There are no hardcoded product facts or answers, the browser never
calls OpenAI, and starter queries just send real messages to `/ai/chat`.

```
Browser ── Next.js (web/, :3002)
             │  typed API client (web/src/lib/api)
             ▼
          NestJS API (:3001) ── /ai/chat ── OpenAI tool calling
             │                                   │
             └──── commerce services ◀───────────┘
                         │
                     PostgreSQL
```

### Layout

| Area | Content | Source |
|---|---|---|
| Header | Title, demo business, API connection status | `GET /products` ping |
| Left: AI assistant | Conversation, starter queries, loading and error states, inline date-check card, "payment unavailable" notice | `POST /ai/chat` with `history` and `context.productSlugs`; `GET /products/:slug/date-check` (same arguments the assistant's `check_date` call used) |
| Right: Product | Name, brand, format, duration, classes, schedule, class length, coach, audience, published package, access, requirements | `GET /products/:slug`, `GET /products/:slug/schedule` |
| Right: Enrollment | Status, with a plain-language qualifier when not confirmed ("Open* · shown as open in the prototype; not confirmed by …") | `GET /products/:slug/enrollment` |
| Right: Payment | Separate from enrollment. Link only if usable; otherwise a disabled button plus the reason and a "View details" comparison | `GET /products/:slug/checkout` and the chat `CHECKOUT` / `CHECKOUT_UNAVAILABLE` actions |
| Bottom: Technical details | Tool trace (tool, result, ms, validated arguments), model round trips, actions, context, transaction-safety state | `toolTrace`, `actions`, `meta` from `/ai/chat`; checkout eligibility flags |

- **Product context:** the panel follows the latest `VIEW_PRODUCT` or checkout action, falling
  back to `context.productSlugs`, and reloads after every answer. The frontend never resolves
  products itself.
- **Friendly labels:** enum codes are mapped to labels in `web/src/lib/labels.ts`. Raw codes
  appear only in the technical panel.

### How transaction blocking is displayed

With the current data (`CHECKOUT_UNAVAILABLE`, `PRICE_CONFLICT`), the Payment card shows:

- **Verification required**, with a disabled **Payment unavailable** button;
- "Published program pricing and the captured checkout pricing do not currently match.";
- **View details**, which expands to:
  - Published program offer: $499 USD · package total
  - Captured checkout: $179 USD / year
  - Status: Needs business confirmation
  - "These commercial terms conflict, so this prototype does not expose the payment link until
    the discrepancy is resolved."

The card renders a link **only** when the domain reports `usable: true` with a URL **and** no
`CHECKOUT_UNAVAILABLE` action exists for the product. A blocked URL never reaches the browser,
because the API already withholds it. Assistant prose is rendered as text without auto-linking,
so the model can't produce a clickable link either. Status is always conveyed with an icon and
text, not colour alone.

Screenshots from a real run (gpt-5-mini, Europe/London) are in [`docs/demo/`](docs/demo/).

### Run the complete prototype

```bash
# 1. backend (from the repo root)
cp .env.example .env                 # set OPENAI_API_KEY; CORS_ORIGINS defaults to http://localhost:3002
pnpm install                         # installs root + web (pnpm workspace)
docker compose up -d --wait
pnpm db:migrate && pnpm db:seed
pnpm build && pnpm start             # API on http://localhost:3001

# 2. frontend (second terminal)
cp web/.env.example web/.env.local   # NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
pnpm --dir web build && pnpm --dir web start   # http://localhost:3002  (or: pnpm --dir web dev)
```

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `web/.env.local` | `http://localhost:3001` | API base URL used by the browser |
| `CORS_ORIGINS` | root `.env` | `http://localhost:3002` | Comma-separated origins allowed to call the API |

Port 3002 avoids the commonly used 3000.

### Demo flow (suggested)

1. "I'm a beginner looking for online ballet classes for a year." The product panel populates.
2. "How much is it?" The follow-up reuses the product through `history[].productSlugs`; no
   new search happens.
3. "Can I join around November 6, 2026?" A date card shows Friday (not a class day), the next
   recurring candidate Saturday November 7, and that exceptions are unconfirmed.
4. "How do I enroll and pay?" Enrollment shows Open*. Payment is blocked with the $499 vs
   $179/year comparison, and the trace shows "Blocked · Price conflict".

### Frontend checks

```bash
pnpm --dir web typecheck && pnpm --dir web lint && pnpm --dir web test && pnpm --dir web build
```

The Vitest + Testing Library suite covers:
- no clickable URL for `CHECKOUT_UNAVAILABLE`, even if the checkout data contains one;
- the `PRICE_CONFLICT` blocked state and its details;
- `VIEW_PRODUCT` populating the product panel;
- history and product context sent on follow-up messages;
- friendly labels instead of enum codes;
- the AI-unavailable error state;
- the date card, API error mapping, and prose rendered without links.

**Type sync:** the frontend's API types (`web/src/lib/api/types.ts`) mirror the backend DTOs and
must be kept in sync by hand.
