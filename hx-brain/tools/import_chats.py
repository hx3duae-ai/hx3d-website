#!/usr/bin/env python3
"""Import ChatGPT and Claude chat exports into the HX Brain Obsidian vault.

Usage:
    python3 hx-brain/tools/import_chats.py <export.zip | conversations.json | folder> [...]
            [--vault hx-brain] [--source chatgpt|claude]

What it does:
  * Reads the official data exports:
      - ChatGPT: Settings -> Data controls -> Export data  (zip with conversations.json)
      - Claude:  Settings -> Privacy -> Export data       (zip with conversations.json, projects.json)
  * Writes one Markdown note per conversation to
        <vault>/sources/chats/<chatgpt|claude>/<YYYY-MM-DD>-<title>.md
    with YAML front matter: source, date, tags, project, message count.
  * Builds browsable hubs (Obsidian maps of content):
        <vault>/wiki/history/chat-history.md
        <vault>/wiki/history/tags/<tag>.md
        <vault>/wiki/history/projects/project-<name>.md
  * Safe to re-run: notes are keyed by conversation id, so nothing is duplicated.

Standard library only. No network.
"""
from __future__ import annotations

import argparse
import datetime as dt
import io
import json
import re
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

# ----------------------------------------------------------------------------- tagging
# Keyword rules -> tag. Edit freely; matching is case-insensitive on title + text.
TAG_RULES: dict[str, list[str]] = {
    "hx3d": ["hx3d", "hx 3d", "hx-3d", "hx os"],
    "3d-printing": ["3d print", "طباعة ثلاثية", "طابعة", "filament", "فلامنت", "bambu", "slicer", "stl", "3mf", "pla", "petg", "nozzle"],
    "cad": ["cad", "fusion 360", "blender", "build123d", "step file", "mesh"],
    "instagram": ["instagram", "انستا", "reel", "ريل", "ootto", "carousel", "كاروسيل"],
    "marketing": ["marketing", "تسويق", "campaign", "حملة", "ads", "إعلان", "brand", "هوية", "content", "محتوى", "seo"],
    "sales": ["sales", "مبيعات", "lead", "عميل", "client", "crm", "offer", "عرض سعر", "proposal"],
    "finance": ["invoice", "فاتورة", "vat", "ضريبة", "price", "سعر", "budget", "ميزانية", "profit", "ربح", "cost", "تكلفة"],
    "code": ["python", "javascript", "typescript", "react", "next.js", "nextjs", "api", "function", "error", "bug", "npm", "git"],
    "design": ["design", "تصميم", "logo", "شعار", "figma", "canva", "ui", "ux", "font", "خط"],
    "video": ["video", "فيديو", "remotion", "veo", "voiceover", "تعليق صوتي", "edit", "مونتاج"],
    "ai-tools": ["claude", "chatgpt", "gpt", "prompt", "mcp", "agent", "وكيل", "skill", "plugin"],
    "personal": ["health", "صحة", "family", "عائلة", "travel", "سفر", "gym", "رياضة", "recipe", "وصفة"],
    "learning": ["explain", "اشرح", "how does", "كيف يشتغل", "course", "دورة", "learn", "تعلم"],
}
MAX_TAGS = 6


def slugify(text: str, limit: int = 60) -> str:
    text = re.sub(r"[\\/:*?\"<>|#^\[\]\n\r\t]", " ", text or "").strip()
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-.")
    return (text[:limit].rstrip("-.") or "untitled").lower()


def guess_tags(title: str, body: str) -> list[str]:
    hay = f"{title}\n{body[:20000]}".lower()
    scored = []
    for tag, words in TAG_RULES.items():
        hits = 0
        for w in words:
            w = w.lower()
            # Latin keywords match whole words only ("ui" must not match "build"); Arabic matches as substrings.
            hits += len(re.findall(rf"(?<![a-z0-9]){re.escape(w)}(?![a-z0-9])", hay)) if w.isascii() else hay.count(w)
        if hits:
            scored.append((hits, tag))
    scored.sort(reverse=True)
    return [t for _, t in scored[:MAX_TAGS]] or ["misc"]


def to_date(value) -> dt.datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return dt.datetime.fromtimestamp(float(value), tz=dt.timezone.utc)
    try:
        return dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


# ----------------------------------------------------------------------------- loaders
def load_inputs(paths: list[Path]) -> list[tuple[str, dict[str, object]]]:
    """Return [(label, {filename: parsed_json})] for each input."""
    bundles = []
    for p in paths:
        files: dict[str, object] = {}
        if p.is_dir():
            for f in p.rglob("*.json"):
                files[f.name] = json.loads(f.read_text(encoding="utf-8"))
        elif p.suffix.lower() == ".zip":
            with zipfile.ZipFile(p) as z:
                for name in z.namelist():
                    if name.lower().endswith(".json"):
                        with z.open(name) as fh:
                            try:
                                files[Path(name).name] = json.load(io.TextIOWrapper(fh, encoding="utf-8"))
                            except json.JSONDecodeError:
                                pass
        else:
            files[p.name] = json.loads(p.read_text(encoding="utf-8"))
        bundles.append((p.name, files))
    return bundles


def detect(convs: list) -> str:
    sample = next((c for c in convs if isinstance(c, dict)), {})
    if "mapping" in sample:
        return "chatgpt"
    if "chat_messages" in sample:
        return "claude"
    return "unknown"


def chatgpt_messages(conv: dict) -> list[tuple[str, str, dt.datetime | None]]:
    mapping = conv.get("mapping") or {}
    # Follow the active branch from current_node back to the root.
    node_id = conv.get("current_node")
    chain = []
    seen = set()
    while node_id and node_id in mapping and node_id not in seen:
        seen.add(node_id)
        chain.append(mapping[node_id])
        node_id = mapping[node_id].get("parent")
    if not chain:  # fallback: every node, in time order
        chain = sorted(mapping.values(), key=lambda n: ((n.get("message") or {}).get("create_time") or 0))
    else:
        chain.reverse()
    out = []
    for node in chain:
        msg = node.get("message") or {}
        role = (msg.get("author") or {}).get("role")
        if role not in ("user", "assistant"):
            continue
        if (msg.get("metadata") or {}).get("is_visually_hidden_from_conversation"):
            continue
        content = msg.get("content") or {}
        parts = content.get("parts") or []
        text_parts = []
        for part in parts:
            if isinstance(part, str):
                text_parts.append(part)
            elif isinstance(part, dict):
                if part.get("content_type") == "image_asset_pointer":
                    text_parts.append("_[image]_")
                elif isinstance(part.get("text"), str):
                    text_parts.append(part["text"])
        if not text_parts and isinstance(content.get("text"), str):
            text_parts.append(content["text"])
        text = "\n".join(t for t in text_parts if t).strip()
        if text:
            out.append((role, text, to_date(msg.get("create_time"))))
    return out


def claude_messages(conv: dict) -> list[tuple[str, str, dt.datetime | None]]:
    out = []
    for m in conv.get("chat_messages") or []:
        role = "user" if m.get("sender") == "human" else "assistant"
        text = m.get("text") or ""
        if not text:
            chunks = []
            for c in m.get("content") or []:
                if isinstance(c, dict) and c.get("type") == "text":
                    chunks.append(c.get("text") or "")
            text = "\n".join(chunks)
        files = [f.get("file_name") for f in (m.get("attachments") or []) + (m.get("files") or []) if isinstance(f, dict) and f.get("file_name")]
        if files:
            text += "\n\n_Attachments: " + ", ".join(files) + "_"
        text = text.strip()
        if text:
            out.append((role, text, to_date(m.get("created_at"))))
    return out


# ----------------------------------------------------------------------------- writer
def yaml_list(items: list[str]) -> str:
    return "[" + ", ".join(json.dumps(i, ensure_ascii=False) for i in items) + "]"


def render_note(source: str, conv_id: str, title: str, created, updated, project: str | None,
                tags: list[str], messages) -> str:
    who = {"user": "**You**", "assistant": "**ChatGPT**" if source == "chatgpt" else "**Claude**"}
    lines = [
        "---",
        f"title: {json.dumps(title, ensure_ascii=False)}",
        f"source: {source}",
        f"conversation_id: {conv_id}",
        f"created: {created.date().isoformat() if created else ''}",
        f"updated: {updated.date().isoformat() if updated else ''}",
        f"project: {json.dumps(project, ensure_ascii=False) if project else ''}",
        f"tags: {yaml_list(['chat/' + source] + tags)}",
        f"messages: {len(messages)}",
        "---",
        "",
        f"# {title}",
        "",
        f"Source: {source} · {created.strftime('%Y-%m-%d %H:%M') if created else 'unknown date'}"
        + (f" · Project: [[project-{slugify(project)}|{project}]]" if project else ""),
        "",
    ]
    for role, text, when in messages:
        stamp = f" · {when.strftime('%H:%M')}" if when else ""
        lines += [f"### {who[role]}{stamp}", "", text, ""]
    return "\n".join(lines)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", nargs="+", type=Path)
    ap.add_argument("--vault", type=Path, default=Path(__file__).resolve().parents[1])
    ap.add_argument("--source", choices=["chatgpt", "claude"], help="force the export type")
    args = ap.parse_args(argv)

    vault: Path = args.vault
    hubs = vault / "wiki" / "history"
    by_tag: dict[str, list] = defaultdict(list)
    by_project: dict[str, list] = defaultdict(list)
    written = 0
    totals = defaultdict(int)

    # Index existing notes by conversation id so re-runs overwrite instead of duplicating.
    existing: dict[str, Path] = {}
    for f in (vault / "sources" / "chats").rglob("*.md") if (vault / "sources" / "chats").exists() else []:
        m = re.search(r"^conversation_id: (\S+)$", f.read_text(encoding="utf-8", errors="ignore")[:2000], re.M)
        if m:
            existing[m.group(1)] = f

    for label, files in load_inputs(args.inputs):
        convs = files.get("conversations.json")
        if convs is None:
            print(f"skip {label}: no conversations.json inside", file=sys.stderr)
            continue
        if isinstance(convs, dict):
            convs = convs.get("conversations") or list(convs.values())
        source = args.source or detect(convs)
        if source == "unknown":
            print(f"skip {label}: unrecognised export format", file=sys.stderr)
            continue

        # Project names (Claude projects.json; ChatGPT project ids -> label)
        projects: dict[str, str] = {}
        for p in files.get("projects.json") or []:
            if isinstance(p, dict) and p.get("uuid"):
                projects[p["uuid"]] = p.get("name") or p["uuid"]

        out_dir = vault / "sources" / "chats" / source
        out_dir.mkdir(parents=True, exist_ok=True)

        for conv in convs:
            if not isinstance(conv, dict):
                continue
            conv_id = str(conv.get("id") or conv.get("conversation_id") or conv.get("uuid") or "")
            title = (conv.get("title") or conv.get("name") or "").strip() or "Untitled chat"
            if source == "chatgpt":
                msgs = chatgpt_messages(conv)
                created, updated = to_date(conv.get("create_time")), to_date(conv.get("update_time"))
                pid = conv.get("gizmo_id") or conv.get("conversation_template_id")
                project = projects.get(pid) or (f"ChatGPT project {pid[-6:]}" if pid and str(pid).startswith("g-p-") else None)
            else:
                msgs = claude_messages(conv)
                created, updated = to_date(conv.get("created_at")), to_date(conv.get("updated_at"))
                pid = (conv.get("project") or {}).get("uuid") if isinstance(conv.get("project"), dict) else conv.get("project_uuid")
                project = projects.get(pid) if pid else None
            if not msgs:
                continue
            body = "\n".join(t for _, t, _ in msgs)
            tags = guess_tags(title, body)
            fname = f"{created.date().isoformat() if created else 'undated'}-{slugify(title)}"
            target = existing.get(conv_id)
            if target is None:
                target = out_dir / f"{fname}.md"
                n = 2
                while target.exists():
                    target = out_dir / f"{fname}-{n}.md"
                    n += 1
                if conv_id:
                    existing[conv_id] = target
            target.write_text(render_note(source, conv_id, title, created, updated, project, tags, msgs), encoding="utf-8")
            written += 1
            totals[source] += 1
            entry = (created.date().isoformat() if created else "undated", target.stem, title, source)
            for t in tags:
                by_tag[t].append(entry)
            if project:
                by_project[project].append(entry)

    if not written:
        print("Nothing imported.", file=sys.stderr)
        return 1

    # ---- hubs (rebuilt from every note on disk, so they include earlier imports)
    by_tag.clear(); by_project.clear()
    for f in sorted((vault / "sources" / "chats").rglob("*.md")):
        head = f.read_text(encoding="utf-8", errors="ignore").split("\n---", 1)[0]
        meta = dict(re.findall(r"^(\w+): (.*)$", head, re.M))
        title = json.loads(meta["title"]) if meta.get("title", "").startswith('"') else meta.get("title", f.stem)
        entry = (meta.get("created") or "undated", f.stem, title, meta.get("source", ""))
        for t in json.loads(meta.get("tags", "[]")):
            if not t.startswith("chat/"):
                by_tag[t].append(entry)
        proj = meta.get("project", "")
        if proj:
            by_project[json.loads(proj)].append(entry)

    def hub(path: Path, heading: str, entries, tags: list[str]):
        path.parent.mkdir(parents=True, exist_ok=True)
        rows = [f"- {d} · [[{stem}|{title}]] · {src}" for d, stem, title, src in sorted(entries, reverse=True)]
        path.write_text("\n".join([
            "---", f"tags: {yaml_list(tags)}", "sources: [chat-exports]",
            f"created: {dt.date.today().isoformat()}", f"updated: {dt.date.today().isoformat()}", "---", "",
            f"# {heading}", "", f"{len(rows)} conversations.", "", *rows, ""]), encoding="utf-8")

    for tag, entries in by_tag.items():
        hub(hubs / "tags" / f"{slugify(tag)}.md", f"Chats tagged #{tag}", entries, ["history", tag])
    for proj, entries in by_project.items():
        hub(hubs / "projects" / f"project-{slugify(proj)}.md", f"Project: {proj}", entries, ["history", "project"])

    idx = ["---", "tags: [history]", "sources: [chat-exports]",
           f"created: {dt.date.today().isoformat()}", f"updated: {dt.date.today().isoformat()}", "---", "",
           "# Chat History", "", "Imported ChatGPT and Claude conversations, browsable by tag and project.", "",
           "## Tags", ""]
    idx += [f"- [[{slugify(t)}|#{t}]] · {len(e)}" for t, e in sorted(by_tag.items(), key=lambda kv: -len(kv[1]))]
    idx += ["", "## Projects", ""]
    idx += [f"- [[project-{slugify(p)}|{p}]] · {len(e)}" for p, e in sorted(by_project.items())] or ["- (none)"]
    hubs.mkdir(parents=True, exist_ok=True)
    (hubs / "chat-history.md").write_text("\n".join(idx) + "\n", encoding="utf-8")

    log = vault / "wiki" / "log.md"
    with log.open("a", encoding="utf-8") as fh:
        fh.write(f"\n## [{dt.date.today().isoformat()}] import | Chat history\n"
                 f"Imported {written} conversations ({', '.join(f'{k}: {v}' for k, v in totals.items())}). "
                 f"Hubs: [[chat-history|Chat History]] ({len(by_tag)} tags, {len(by_project)} projects).\n")
    print(f"Imported {written} conversations → {vault/'sources'/'chats'}  ({dict(totals)})")
    print(f"Hubs: {hubs/'chat-history.md'}  ({len(by_tag)} tags, {len(by_project)} projects)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
