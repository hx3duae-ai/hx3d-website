# HX 3D — Owner-only pricing policy

**Rule:** only the platform owner calculates, decides, enters, edits, approves, rejects and sends
printing prices. Nobody else — customers, employees, NAJM or any AI agent — can, and the system
enforces this on the server, not just in the interface.

> قاعدة: صاحب العمل وحده يحدد السعر. لا الذكاء الاصطناعي ولا الموظف ولا العميل يحسب أو يقدّر أو يقترح أو يعتمد أي سعر.

## Who can do what

| Action | Customer | NAJM / AI agent | Employee | Owner |
|---|---|---|---|---|
| Submit a quotation request, upload 3D files | ✅ | ✅ | ✅ | ✅ |
| Ask for / record missing information | — | ✅ (own requests) | ✅ (assigned) | ✅ |
| Change workflow status (new / needs info / under review / ready for owner / cancelled) | — | limited | ✅ (assigned, before owner decision) | ✅ |
| See all requests, download uploaded files | — | — | — | ✅ |
| Enter / edit amounts | — | ❌ | ❌ | ✅ |
| Approve / reject, send to the customer | — | ❌ | ❌ | ✅ |
| See internal pricing, audit log, CRM prices and sales figures | — | ❌ | ❌ | ✅ |
| See the quotation | after the owner sends it | ❌ | ❌ | ✅ |

There is **no automatic price calculator** anywhere. HX Studio's old "suggested price" calculator
was removed; it now reports only filament grams, print hours and colour changes.

## How it is enforced

**HX OS (`hx-os/`)**
- `lib/auth.ts`: identity from secrets in environment variables (`HX_OWNER_TOKEN`, `HX_EMPLOYEE_TOKENS`,
  `HX_AGENT_TOKENS`), sent as `Authorization: Bearer …` or the httpOnly `hx_session` cookie from `/login`.
  Constant-time comparison. With no owner token configured, every pricing route returns 503 (fails closed).
- `requireOwner()` runs on every pricing route:
  - `GET/PUT /api/quotes/:id/pricing`
  - `POST /api/quotes/:id/decision`
  - `POST /api/quotes/:id/send`
  - `GET /api/quotes/:id/audit`
  - `GET /api/audit`
  - `GET /api/quotes/:id/files/:fileId`
- `lib/quotes.ts` checks the owner again inside every pricing function (defence in depth).
- Requests (`data/quotes.json`) and pricing (`data/pricing.json`) are stored apart. Non-owner routes never
  read `pricing.json`.
- Any price-like field (`price`, `amount`, `total`, `cost`, `unit`, `discount`, `margin`, `vat`, `سعر`…) sent by
  a non-owner to a request or CRM endpoint is rejected with 403 and audited.
- Once the owner has approved, rejected or sent a quote, only the owner can change it. Editing amounts
  after approval returns it to draft, so it must be approved again.
- The customer sees only the frozen copy that was **sent**. Later owner drafts stay private until resent.
  The internal note is never sent.
- CRM: `price` is accepted only from the owner. `GET /api/crm/clients` and `/api/crm/stats` hide amounts
  from everyone else.

**Audit log** (`data/audit.json`, append-only, owner-only API): request created/updated/status,
files added, every pricing change (before → after), approvals, rejections, sends, customer replies,
CRM price changes, and **every denied attempt**.

**AI agents**
- NAJM / Instagram inbox AI: a fixed rule is added to every prompt. It never states, estimates or suggests a
  price, and it forwards details to the owner. The old "price guide" the AI could quote from was removed.
- Content generation (`lib/claude.ts`): told never to mention prices.
- `.claude/agents/*` and the founder-board / team skills: no agent computes or suggests prices. Finance only
  copies amounts the owner approved.
- `.claude/hooks/protect_pricing.py` (PreToolUse hook) blocks Claude Code agents from reading or writing the
  pricing, audit and CRM data files directly, and from calling the owner pricing endpoints.

**HX Studio (`hx-studio/`)**: `/api/business/cost` returns 410 (removed). `/api/business/usage` returns grams
and hours only. The quote PDF (`/api/business/quote`) requires `x-owner-token` = `HX_OWNER_TOKEN`.

## Owner setup
1. Generate a secret: `openssl rand -base64 32`.
2. Put it in `hx-os/.env.local` as `HX_OWNER_TOKEN=…`. For HX Studio, set the same variable in its environment.
3. Optional: `HX_EMPLOYEE_TOKENS=sara:<token>` and `HX_AGENT_TOKENS=najm:<token>`.
4. Open `/login` and enter your token. Never share it or commit it.
