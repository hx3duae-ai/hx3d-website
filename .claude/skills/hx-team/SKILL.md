---
name: hx-team
description: Runs the HX 3D UAE agent team on a client, passing the work along in order Sales → Marketing → Support → Finance. Use when the founder pastes a new lead or says "شغل الفريق", "مرر العميل للفريق", "hx team", "run the pipeline", or asks where a client is in the pipeline ("وين وصل العميل").
---

# HX Team: the four-agent pipeline

```
 lead ──► hx-sales ──► hx-marketing ──► hx-support ──► hx-finance ──► done
          qualify       build offer      follow up      invoice + VAT
          + CRM         (OOTTO proof)    (Chatwoot)     + journal
```

Each agent reads and writes one shared **pipeline card** at `hx-team/pipeline/<date>-<client>.md`. The card's `stage:` field says whose turn it is.

## How to run it

1. **New lead**: launch the `hx-sales` agent with the lead text. It returns `HANDOFF → hx-marketing` and the card path.
2. Launch `hx-marketing` with that card path → it returns `HANDOFF → hx-support`.
3. Launch `hx-support` with the card path.
   - `WAITING` → stop here. Tell the founder the next follow-up date. Resume later from step 3.
   - `HANDOFF → hx-finance` → continue.
4. Launch `hx-finance` with the card path → `DONE`.

Pass each agent only the card path plus its handoff line. Everything else lives in the card.

## Resuming / status
- "وين وصل العميل X": find its card in `hx-team/pipeline/`, read `stage:`, and launch the agent for that stage.
- "وضع الفريق": list every card with stage ≠ `done`, grouped by stage.

## Stop and ask the founder when
- price is `TBD` at the Finance step — no agent may fill it in; only the owner prices (`PRICING-POLICY.md`)
- an agent wants to send anything to a client (all client messages are drafts or Chatwoot private notes)
- a client complains or asks for a refund
