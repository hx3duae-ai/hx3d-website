# HX Core — shared foundation for NAJM AI, Social Automation, Marketing Center and Viral Reels Studio

All four systems run on **one** Next.js app, **one** Postgres database (Prisma) and the services below.
Nothing here talks to customers or spends money on its own: every outward action passes the policy gate.

| Service | File | What it guarantees |
|---|---|---|
| Permission Management | `src/lib/core/permissions.ts`, `guard.ts` | Role defaults + per-user grants (staff only). `integrations.live`, `secrets.manage`, `permissions.manage`, `marketing.spend` are **owner-only** and cannot be granted. Messaging (`social.*`) and advertising (`marketing.*`) are independent; NAJM has no marketing permission. |
| Secure Secrets Manager | `secrets.ts` | AES-256-GCM, key from `ENCRYPTION_KEY`, secret name bound as AAD, fresh IV, key rotation (`ENCRYPTION_KEY_PREVIOUS` + `rotateAll`). Write-only UI: only the last 4 characters are shown. Vault first, env var fallback. |
| Integration Manager | `integrations.ts` | Registry of every external connection, per-integration mode `disabled / dry_run / test / live` (default: disabled + dry_run), global **kill switch**, and `gate(key, action)` — `read / write / send / spend`. Each integration has an allow-list (Shopify: read only; Meta messaging cannot spend). Spending only in live mode with a recorded owner approval. |
| Webhook Manager | `webhooks.ts`, `app/api/webhooks/[source]` | Size limit → signature on the raw body (Shopify HMAC base64, Meta `X-Hub-Signature-256`) → idempotency `(source, eventId)` → job → fast 200. Bad signatures are not stored. Meta GET handshake checks the verify token in constant time. |
| Background Job Queue | `jobs.ts`, `scripts/worker.ts` (`npm run worker`) | Postgres queue, `FOR UPDATE SKIP LOCKED` (safe with many workers), idempotency keys, retry with exponential backoff + jitter, dead-letter + action-required notification, stale-lock recovery. |
| Retry / Error Handling | `retry.ts`, `errors.ts` | Retries only 429 / 5xx / network errors. `redact()` masks Meta/Shopify/Anthropic tokens, bearer headers and key=value secrets before anything is stored or shown. |
| File Storage + secure links | `storage.ts`, `app/api/files/[token]` | Private directory outside the web root, type detected from bytes (STL/3MF/PDF/MP4/PNG/JPG), SHA-256 integrity check, path-traversal proof keys. Download grants: 256-bit token shown once (only its hash stored), expiry ≤ 7 days, download limit enforced atomically, revocable. **Private files can never be sent by a campaign** — only for `order:` or by staff (`manual:`). |
| Notification Center | `notifications.ts` | Deduplicated, counted, reopened when a resolved problem returns. |
| Audit Logs | existing `audit.ts` + `admin/system/audit` | Every sensitive action (secret set/delete, mode change, live approval, kill switch, permission grant, job retry) is logged without secret values. |
| Contacts + Activity | `activity.ts` | One contact across channels (concurrency-safe); one activity stream every system writes to (with `videoId` / `campaignId` for attribution). |
| Health / Sync logs | `health.ts`, `SyncLog` model, `app/api/health` | Per-integration check; `unverified` = credentials present but not proven by a real call. Public `/api/health` reveals only ok/down. |
| **HX Command Center** | `command-center.ts`, `admin/command` | Contacts, files sent, top videos by results, ads, orders & sales, NAJM status, integrations, errors and items needing you. A figure is shown only when its source is connected. |

## Run
```bash
cp .env.example .env            # fill DATABASE_URL, SESSION_SECRET, ENCRYPTION_KEY
npx prisma migrate deploy
ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed
npm run build && npm start      # web
npm run worker                  # background jobs (separate process)
DATABASE_URL=... npm test       # unit + real-database tests
```

## Not done in this phase (said plainly)
* No real Meta, Shopify or LLM connection was made: those need your accounts (Meta app review, Shopify app credentials, LLM key).
  Signature checks were tested with locally computed signatures, not with deliveries from Meta or Shopify.
* Shopify Client ID / Secret are still read from the environment by the existing client (shown as "env only" in the UI).
* Storage is the local disk. Production needs a persistent disk or an S3-compatible driver (to add behind the same API).
* The login rate limiter is still in memory (pre-existing).
