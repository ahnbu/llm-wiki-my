---
title: Query Command
created: 2026-05-22 11:41
session_id:
session_path:
ai: unknown
description: "Ask questions against the compiled wiki. Supports quick/standard/deep depth levels, --list for browsing, --include-archived for explicit archived reads, and --resume to reload context after a session break. Answers from wiki content only, with citations."
argument-hint: "<question> [--quick] [--deep] [--raw] [--list] [--include-excluded] [--include-archived] [--resume] [--tag <tag>] [--category concepts|topics|references] [--with <wiki>...] [--wiki <name>] [--local]"
allowed-tools: Read, Glob, Grep, Bash(ls:*), Edit
---

## Your task

**Resolve the wiki.** Read `skills/wiki-manager/references/querying.md` for the shared query contract, then follow these wiki resolution steps. Do not search unrelated filesystem locations or read unrelated reference files.
1. Read `$HOME/.config/llm-wiki/config.json`. If it has `hub_path`, expand leading `~` only (not tildes in `com~apple~CloudDocs`) and prefer that path; use `resolved_path` only as a fallback cache when the expanded `hub_path` is unavailable and `resolved_path` is initialized. If config has only `resolved_path`, use it. If the configured path can be statted but reading `wikis.json` or listing `topics/` fails with `Operation not permitted`, stop and ask the user to grant Full Disk Access/iCloud Drive access to the launcher; do not fall back to `~/wiki` or `resolved_path`. Do not write machine-specific `resolved_path` into shared configs.
2. If no config → read `$HOME/wiki/_index.md`. If it exists → HUB = `$HOME/wiki`. If nothing found, ask the user where to create the wiki.
3. **Wiki location** (first match): `--local` → `.wiki/` in CWD; `--wiki <name>` → `HUB/wikis.json` lookup with portable path resolution (`<HUB>`, `~`, absolute, or HUB-relative); if the registry path is stale, fall back to `HUB/topics/<name>`; CWD has `.wiki/` → use it; else → HUB.
4. Read `<wiki>/_index.md` to verify. If missing → stop with "No wiki found (or no articles compiled). Run `/wiki init` and `/wiki:compile` first."

Answer the question in $ARGUMENTS using ONLY the knowledge in the wiki. Read `skills/wiki-manager/references/querying.md` and follow it as the source of truth for query retrieval, citation, output format, no-evidence behavior, and list/resume exceptions. This command file owns Claude slash-command argument parsing and wiki resolution only; it must not duplicate the common query contract.

Korean by default: Answer in Korean unless the user explicitly asks for another language. Keep citations and file paths unchanged. If the wiki lacks evidence, say that in Korean and suggest what source to ingest.

Inventory awareness: for factual questions, inventory is not evidence. Cite
compiled wiki articles and raw sources, not operational inventory records. For
meta-questions about candidates, backlogs, next actions, what to track, or
"what should become inventory", read inventory indexes and answer as an
inventory/listing task. Keep the output compact and say when an item is too
small for inventory, too large and should become a dataset/collection, or out
of scope.

### Parse $ARGUMENTS

- **question**: Everything that is not a flag
- **--quick**: Fast answer from indexes only (no full article reads)
- **--deep**: Thorough answer — read all related articles, follow all links, search raw, peek sibling wikis
- **--raw**: Also search raw sources (implied by --deep)
- **--include-excluded**: Include sources listed in `raw/_source-exclusions.json` when searching raw/deep. Label any such citation as excluded.
- **--list**: Return a ranked list of matching articles instead of a synthesized answer. Useful for browsing what the wiki has on a topic before diving in.
- **--include-archived**: Explicitly allow archived topic wikis or archived
  supplementary wikis to be read. Label archived citations clearly.
- **--resume**: Load recent activity context and show a "where you left off" briefing. If a question is also provided, answer it after the briefing using standard depth.
- **--tag <tag>**: Filter to articles with this tag in frontmatter
- **--category <cat>**: Search only in concepts, topics, or references
- **--with <wiki>**: Load a supplementary wiki as additional context when answering. The primary wiki provides the subject; `--with` wikis provide craft/skill knowledge. Multiple `--with` flags allowed.
- No depth flag = **standard** (default)

### Archive Visibility

Archived topic wikis are preserved under `HUB/topics/.archive/<slug>/` and are
quiet by default:

- Quick, standard, and list queries exclude archived wikis unless
  `--include-archived` is present.
- If the primary `--wiki <name>` target is archived, stop and ask the user to
  restore it or rerun with `--include-archived`.
- If a `--with <wiki>` supplementary wiki is archived, reject it unless
  `--include-archived` is present.
- Deep queries read archived sibling `_index.md` files only and show an
  `Archived Matches` section when relevant. Do not read archived articles or
  cite archived material as evidence unless `--include-archived` is present.
- When archived content is included, label every archived source/citation with
  `archived`.

### Index Freshness Check

Before using any `_index.md`, verify it's current: count `.md` files in the directory (excluding `_index.md`) and compare against rows in the index table. If counts differ, rebuild the index inline from file frontmatter before proceeding. See `references/indexing.md` Derived Index Protocol.

### Query Protocol

The shared query protocol lives in `skills/wiki-manager/references/querying.md`.
After parsing flags above, apply that reference exactly:

- quick, standard, deep, list, and resume behavior
- citation format with dual links
- `Sources used` and `Knowledge gaps` output contract
- raw, excluded, archived, and sibling wiki handling
- no-evidence behavior
- query logging
