---
name: REPLACE-with-kebab-case-name
description: REPLACE. Write one or two sentences in the third person. Say WHAT the skill produces and WHEN to use it, including the phrases a user would type (for example "make a deck", "extract tables from a PDF"). Claude decides whether to load the skill from this text alone, so be specific and a little pushy.
---

# REPLACE: Skill Title

One-paragraph purpose: what this skill does and what "done" looks like.

## When to use
- Trigger 1 (the user asks for ...)
- Trigger 2 (a file of type ... is involved)

## When NOT to use
- Case that belongs to another skill, or a plain question with no file or artifact.

## Inputs
- What the user gives you (files, paths, data, options). Say what to do if something is missing: ask one question, then proceed with a stated default.

## Steps
1. Step one, with the exact command or tool to use.
2. Step two. Keep steps in the order they must run.
3. Verify the output (open the file, run the check script, compare counts). Do not declare success before this.

## Output
- Where the result is saved (for example `outputs/<name>.<ext>`).
- What to tell the user: the path and a 2-3 line summary.

## Bundled resources (optional)
- `scripts/` for deterministic helpers (run them, do not retype their logic)
- `references/` for long docs loaded only when needed
- `assets/` for templates and files copied into the output

## Quality checklist
- [ ] Trigger phrases in the description match how users actually ask
- [ ] Every step is concrete (commands, paths, tools), not advice
- [ ] Verification step exists and is run
- [ ] Under ~500 lines; move bulk into `references/`
