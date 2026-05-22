---
title: Querying Reference
created: 2026-05-22 11:40
session_id:
session_path:
ai: unknown
---

# Querying Reference

This file is the source of truth for query retrieval and output contracts.
`commands/query.md`, Codex, and OpenCode must refer to this file instead of
duplicating the same rules elsewhere.

## Purpose

Answer questions from the target wiki only. Query is not general ChatGPT mode:
do not use training data to fill missing evidence. If the wiki does not contain
enough evidence, say so and suggest what to ingest.

## Resolution

Resolve the active wiki using `references/command-prelude.md` and
`references/hub-resolution.md`. Read the target wiki `_index.md` before reading
article bodies. If no compiled articles exist, stop and ask the user to
initialize, ingest, or compile first.

## Depths

### Quick

Use indexes only. Cite index entries in `Sources used`. If indexes do not
contain enough evidence, say so and suggest rerunning as a standard query.

### Standard

Use this for most questions.

1. Read the master `_index.md`.
2. Read relevant category `_index.md` files.
3. Identify 3-8 relevant compiled articles.
4. Read those articles in full.
5. Follow directly relevant `See Also` links.
6. Grep `wiki/` for key terms that indexes may have missed.
7. Synthesize an answer using only wiki evidence.

### Deep

Use this for cross-topic or high-stakes synthesis.

1. Read all relevant `_index.md` files.
2. Read all relevant articles.
3. Follow relevant `See Also` links.
4. Grep `wiki/` and `raw/` for key terms, synonyms, and related concepts.
5. Skip raw sources listed in `raw/_source-exclusions.json` unless
   `--include-excluded` is present.
6. Peek active sibling wiki indexes from `HUB/wikis.json`.
7. For archived sibling wikis, read only archived `_index.md` files unless
   `--include-archived` is present.

## List Mode

When `--list` is set, return a ranked list of matching articles instead of a
synthesized answer.

Output:

```markdown
## Search Results for "<query>"

Found N results:

### Wiki Articles
1. **[[article-slug|Title]] ([Title](wiki/concepts/article-slug.md))** — summary — tags: tag1, tag2

### Raw Sources
1. **[[raw-source-slug|Title]] ([Title](raw/articles/raw-source.md))** — summary — type: articles
```

If no results are found, suggest alternative search terms or sources to ingest.
Do not include `Sources used` or `Knowledge gaps` in list mode.

## Resume Mode

If `--resume` has no question, output only the resume briefing. Do not include
`Sources used` or `Knowledge gaps`.

If `--resume` has a question, show the briefing first, then answer the question
using the normal query output contract.

## Citation Format

Use dual links for compiled wiki article citations:

```markdown
[[article-slug|Article Title]] ([Article Title](wiki/concepts/article-slug.md))
```

Include article confidence when available:

```markdown
[[article-slug|Article Title]] ([Article Title](wiki/concepts/article-slug.md)) (confidence: high) — what was drawn from it
```

Use dual links for raw sources when raw sources were actually read:

```markdown
[[raw-source-slug|Raw Source Title]] ([Raw Source Title](raw/articles/raw-source.md)) — what was drawn from it
```

Label excluded or archived citations:

```markdown
[[source-slug|Source Title]] ([Source Title](raw/articles/source.md)) (excluded) — why it was used
[[article-slug|Article Title]] ([Article Title](wiki/concepts/article.md)) (archived) — preserved context, not active evidence
```

Inventory records are not factual evidence for factual questions. Cite inventory
only for meta-questions about candidates, backlogs, next actions, or tracking.

## Output Contract

All synthesized query answers must use this format:

```markdown
[Answer in clear prose with markdown formatting]

---
**Sources used:**
- [[article-slug|Article Title]] ([Article Title](wiki/concepts/article-slug.md)) (confidence: high) — what was drawn from it

**Raw sources used:** (only when raw sources were actually read)
- [[raw-source-slug|Raw Source Title]] ([Raw Source Title](raw/articles/raw-source.md)) — what was drawn from it

**Related in other wikis:** (if any, or if deep mode checked siblings)
- [wiki-name]: [[article-slug|Article Title]] ([Article Title](path)) — relevance signal

**Archived matches:** (deep mode only, or if explicitly included)
- [archived-wiki]: [[article-slug|Article Title]] ([Article Title](path)) — archived context, not active evidence

**Knowledge gaps:**
- 없음
```

Rules:

- `Sources used` is always present for synthesized answers.
- `Knowledge gaps` is always present for synthesized answers.
- If there are no gaps, write `- 없음`.
- `Raw sources used` appears only when raw sources were actually read.
- `Related in other wikis` appears when sibling wikis were checked and relevant matches exist, or when deep mode makes the check relevant.
- `Archived matches` appears only in deep mode or when archived content is explicitly included.
- `--list` and resume-only briefing are exceptions and do not use this contract.

## No Evidence Behavior

When the wiki lacks evidence, do not answer from training data. Use this format:

```markdown
현재 wiki에는 이 질문에 답할 충분한 근거가 없습니다.

---
**Sources used:**
- 없음

**Knowledge gaps:**
- [질문에 답하기 위해 부족한 자료]
- Suggested sources to ingest: [구체적인 자료 유형 또는 후보]
```

If relevant articles exist but are weak, answer only the supported part and list
the unsupported part under `Knowledge gaps`.

## Logging

After answering, append to `log.md`:

```markdown
## [YYYY-MM-DD] query | "<question>" → answered from N articles (depth)
```

For no-evidence answers:

```markdown
## [YYYY-MM-DD] query | "<question>" → insufficient wiki evidence
```
