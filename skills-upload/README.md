# Skills ready for claude.ai upload

claude.ai → **Customize → Skills → Upload skill** → choose one `.zip` at a time.

| zip | source | note |
|---|---|---|
| marketing-psychology | coreyhaines31/marketingskills (MIT) | |
| ai-seo | coreyhaines31/marketingskills (MIT) | |
| ad-creative | coreyhaines31/marketingskills (MIT) | |
| lead-magnets | coreyhaines31/marketingskills (MIT) | |
| offers | coreyhaines31/marketingskills (MIT) | my pick for "value" (Hormozi-style value stack) — delete if you meant something else |
| social | coreyhaines31/marketingskills (MIT) | added: Instagram reels/carousels |
| high-end-visual-design | Leonxlnx/taste-skill-classics (MIT) | opt-in in Claude Code; on claude.ai it can trigger by itself. hx3d-brand-style overrides its colours |
| firebase-ai-logic-basics | firebase/agent-skills (Apache-2.0) | the official name of "firebase-ai-logic" |
| shadcn | shadcn-ui/ui (MIT) | the official shadcn/ui skill |
| hx3d-brand-style | HX 3D (your style guide) | black / white / pink #FF66B2 — upload this one first |

The zips are the same files as `.claude/skills/<name>/` minus eval files. Only change: front-matter keys that
claude.ai may reject (`disable-model-invocation`, `user-invocable`, `version`) were removed. Each folder has `LICENSE` and `SOURCE.txt`.
