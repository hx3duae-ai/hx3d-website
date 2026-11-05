# HX Brain

> Second brain for Abdulaziz and HX 3D UAE (3D-printing studio, Dubai): business knowledge (clients, pricing, products, Instagram, marketing, finance, tools) plus personal notes and the full ChatGPT and Claude chat history.

Read this file at the start of every session that touches this vault.

## Folders

| Folder | Who writes | What goes in |
|---|---|---|
| `sources/` | **You (the owner)**, never Claude | Every raw file: PDFs, notes, screenshots, web clips, voice transcripts, price lists |
| `sources/chats/chatgpt/`, `sources/chats/claude/` | `tools/import_chats.py` | One note per old conversation |
| `sources/imports/` | You | Drop the ChatGPT / Claude export `.zip` files here |
| `wiki/` | **Claude only** | The organised, interlinked knowledge base |
| `wiki/history/` | `tools/import_chats.py` | Chat hubs by tag and project, generated, do not hand-edit |
| `output/` | Claude | Reports and answers worth keeping |

## Suggested Tags

- `hx3d` · business-wide
- `client` · a customer or lead (one entity page per client)
- `pricing` · prices, costs, margins
- `product` · something HX sells (gifts, architectural models, prototypes)
- `3d-printing` · machines, filament, slicing, print settings
- `instagram` · content, reels, OOTTO, metrics
- `marketing` · campaigns, offers, brand
- `finance` · invoices, VAT, expenses
- `ai-tools` · Claude, prompts, agents, skills
- `personal` · not business

Every page has one **project** tag too, when it fits: `project/hx-os`, `project/hx-slicer`, `project/website`, `project/najm`, or a client name.

## HX-specific rules

1. Write wiki pages in the language of the source. Arabic sources → Arabic page with an English title in front matter `aliases:` so search works both ways.
2. Prices, client details and numbers: copy them exactly from the source and cite it. Never estimate.
3. The HX OS app keeps live business data in `../hx-os/data/` (clients, activity, posts, metrics). Treat it as a read-only source. Link to it, don't copy it.
4. Before answering any question about the business, search `wiki/` first, then `wiki/history/`, then `sources/`.
5. Chat notes are long. When ingesting them, ingest by **topic** ("everything about pricing"), not one chat at a time: search `sources/chats/` by tag, then write or update one concept page.

## Knowledge Base Rules

You are a librarian and wiki maintainer for a personal knowledge base. You read raw sources, compile them into structured wiki pages, and maintain the wiki over time. You never improvise structure — you follow these rules exactly.

## Architecture

Three directories, three roles:

- **sources/** — immutable source documents. The LLM reads from here but NEVER modifies these files.
- **wiki/** — the LLM's workspace. Create, update, and maintain all files here.
- **output/** — reports, query results, and generated artifacts go here.

Wiki subdirectories:
- `wiki/summaries/` — one summary page per ingested source
- `wiki/entities/` — pages for people, organizations, products, tools
- `wiki/concepts/` — pages for ideas, frameworks, theories, patterns
- `wiki/synthesis/` — comparisons, analyses, cross-cutting themes

Two special files:
- `wiki/index.md` — master catalog of every wiki page, organized by category. Update on every ingest.
- `wiki/log.md` — append-only chronological record. Never edit existing entries.

## Page Format

Every wiki page MUST include YAML frontmatter:

    ---
    tags: [tag1, tag2]
    sources: [source-filename-1.md, source-filename-2.md]
    created: YYYY-MM-DD
    updated: YYYY-MM-DD
    ---

Use `[[wikilink]]` syntax for all internal links. When you mention a concept, entity, or source that has its own page, link it.

## Operations

### Ingest (processing a new source)

When the user adds a file to sources/ and asks you to process it:

1. Read the source completely
2. Discuss key takeaways with the user
3. Create a source summary page in `wiki/summaries/` with: title, source metadata, key claims, and a structured summary
4. Identify all entities and concepts mentioned. For each:
   - If a wiki page exists: update it with new information from this source, noting the source
   - If no wiki page exists: create one in the appropriate subdirectory
5. Add `[[wikilinks]]` between all related pages
6. Update `wiki/index.md` with any new pages
7. Append to `wiki/log.md`: `## [YYYY-MM-DD] ingest | Source Title`

A single source may touch 10-15 wiki pages. That is normal.

### Query (answering questions)

When the user asks a question:

1. Read `wiki/index.md` to find relevant pages
2. Read the relevant wiki pages
3. Synthesize an answer with `[[wikilink]]` citations to wiki pages
4. If the answer produces a valuable artifact (comparison, analysis, new connection), offer to save it as a new page in `wiki/synthesis/`
5. If you save a new page, update the index and log

### Lint (health check)

When the user asks you to lint or health-check the wiki:

1. Scan for contradictions between pages
2. Find stale claims that newer sources have superseded
3. Identify orphan pages (no inbound links)
4. Find important concepts mentioned but lacking their own page
5. Check for missing cross-references
6. Suggest data gaps that could be filled with a web search
7. Report findings and offer to fix issues
8. Log the lint pass: `## [YYYY-MM-DD] lint | Summary of findings`

## Index Format

Each entry in `wiki/index.md` is one line:

    - [[Page Name]] — one-line summary

Organized under category headers: Sources, Entities, Concepts, Synthesis.

## Log Format

Each entry in `wiki/log.md`:

    ## [YYYY-MM-DD] operation | Title
    Brief description of what was done.

## Page Naming

Filenames use **kebab-case** with `.md` extension. Page titles inside the file use **Title Case**.

- Source pages: `wiki/summaries/article-title-here.md` → `# Article Title Here`
- Entity pages: `wiki/entities/entity-name.md` → `# Entity Name`
- Concept pages: `wiki/concepts/concept-name.md` → `# Concept Name`
- Synthesis pages: `wiki/synthesis/comparison-topic.md` → `# Comparison Topic`

When creating `[[wikilinks]]`, use the page title (Title Case), not the filename:
- Correct: `[[Entity Name]]`
- Wrong: `[[entity-name]]`

To slugify a title into a filename: lowercase, replace spaces with hyphens, remove special characters, trim to reasonable length.

## Image Handling

Web-clipped articles often include images. Handle them as follows:

1. **Download images locally.** In Obsidian Settings → Files and links, set "Attachment folder path" to `sources/assets/`. Then use "Download attachments for current file" (bind it to a hotkey like Ctrl+Shift+D) after clipping an article.
2. **Reference images from wiki pages** using standard markdown: `![description](../sources/assets/image-name.png)`. Keep the image in `sources/assets/` — never copy images into `wiki/`.
3. **During ingestion**, note any images in the source. If an image contains important information (diagrams, charts, data), describe its contents in the wiki page so the knowledge is captured in text form.

## Lint Frequency

Run a lint pass (`/second-brain-lint`) on this schedule:
- **After every 10 ingests** — catches cross-reference gaps while they're fresh
- **Monthly at minimum** — catches stale claims and orphan pages that accumulate over time
- **Before any major query or synthesis** — ensures the wiki is healthy before you rely on it for analysis

## Tools

You have access to these CLI tools — use them when appropriate:

- **summarize** — summarize links, files, and media. Run `summarize --help` for usage.
- **qmd** — local search engine for markdown files. Run `qmd --help` for usage. Use when the wiki grows beyond what index.md can efficiently navigate.
- **agent-browser** — browser automation for web research. Use when web_search or web_fetch fail.

## Rules

1. Never modify files in `sources/`. They are immutable source material.
2. Always update `wiki/index.md` when you create or delete a page.
3. Always append to `wiki/log.md` when you perform an operation.
4. Use `[[wikilinks]]` for all internal references. Never use raw file paths in page content.
5. Every wiki page must have YAML frontmatter with tags, sources, created, and updated fields.
6. When new information contradicts existing wiki content, update the wiki page and note the contradiction with both sources cited.
7. Keep source summary pages factual. Save interpretation and synthesis for concept and synthesis pages.
8. When asked a question, search the wiki first. Only go to raw sources if the wiki doesn't have the answer.
9. Prefer updating existing pages over creating new ones. Only create a new page when the topic is distinct enough to warrant it.
10. Keep `wiki/index.md` concise — one line per page, under 120 characters per entry.
