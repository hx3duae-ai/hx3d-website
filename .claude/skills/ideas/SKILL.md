---
name: ideas
description: Content and business ideas for HX 3D UAE from what is happening right now. Use when the user types /ideas or asks "عطني أفكار", "وش أنزل", "content ideas", "وش الفرص". Reads recent email, client requests, Instagram performance and the HX Brain wiki, finds patterns, and proposes ideas.
---

# /ideas

1. Gather the last 14 days:
   - Gmail: client questions and requests (`newer_than:14d`).
   - `hx-os/data/clients.json` and `hx-team/pipeline/`: what people are ordering and asking about.
   - Instagram: `hx-os/data/metrics.json` / `posts.json`, or the Ootto connector if connected: top and bottom posts.
   - Meeting notes: any transcripts in `hx-brain/sources/` from the last 14 days (Granola, if connected).
   - `hx-brain/wiki/`: recurring concepts, and `wiki/history/` for topics the user kept asking about.
2. Find 3 to 5 patterns (repeated questions, products in demand, posts that over-performed, seasonal dates such as UAE National Day and Ramadan).
3. Output:
   - **5 content ideas**: each with the pattern behind it, a hook written with the `virality` skill checklist, format (reel / carousel / story), and a comment keyword.
   - **2 business opportunities**: product, offer or client segment, with the evidence.
   - **1 thing you might be missing.**
4. Offer to save the list to `hx-brain/output/ideas-<date>.md`.
