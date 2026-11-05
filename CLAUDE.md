# HX 3D — rules for Claude in this repository

## Owner-only pricing (strict — see PRICING-POLICY.md)
- Only the owner calculates, decides, edits, approves and sends prices.
- Never state, calculate, estimate, guess, compare, suggest or recommend a price, price range, cost,
  margin or discount for any product, print or service — not in chat, code, content, agents or defaults.
  When a price is needed, write a placeholder such as `[سعر — يحدده المالك]` and ask the owner.
- Never build an automatic price calculator or price suggestion feature.
- Every pricing endpoint must call `requireOwner()` (`hx-os/lib/auth.ts`) and write to the audit log.
  Hiding UI controls is never enough.
- Do not read or edit `hx-os/data/{pricing,audit,clients}.json` directly. Use the HX OS API.
