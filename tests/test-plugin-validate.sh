#!/bin/bash
# Validate plugin manifest and command/skill frontmatter
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PLUGIN_DIR="$PROJECT_ROOT/claude-plugin"
PLUGIN_JSON="$PLUGIN_DIR/.claude-plugin/plugin.json"
PASS=0
FAIL=0
TOTAL=0
REFERENCE_NAMES="archive audit command-prelude compilation datasets hub-resolution indexing ingestion inventory librarian linting projects research-infrastructure wiki-structure"

log_pass() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); printf "  \033[32mPASS\033[0m: %s\n" "$1"; }
log_fail() { FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1)); printf "  \033[31mFAIL\033[0m: %s — %s\n" "$1" "$2"; }

assert_contains() {
  file="$1"
  pattern="$2"
  message="$3"
  if grep -Eq -- "$pattern" "$file"; then
    log_pass "$message"
  else
    log_fail "$message" "missing pattern '$pattern' in $file"
  fi
}

assert_not_contains() {
  file="$1"
  pattern="$2"
  message="$3"
  if grep -Eq -- "$pattern" "$file"; then
    log_fail "$message" "unexpected pattern '$pattern' in $file"
  else
    log_pass "$message"
  fi
}

echo "=== Plugin Validation ==="

# plugin.json
if [ -f "$PLUGIN_JSON" ]; then
  log_pass "plugin.json exists"
  if python3 -c "import json; json.load(open('$PLUGIN_JSON'))" 2>/dev/null; then
    log_pass "plugin.json is valid JSON"
  else
    log_fail "plugin.json is invalid JSON" "parse error"
  fi
else
  log_fail "plugin.json not found at $PLUGIN_JSON" "missing file"
fi

# Every command .md has frontmatter (starts with ---)
echo ""
echo "--- Command frontmatter ---"
for cmd in "$PLUGIN_DIR"/commands/*.md; do
  basename=$(basename "$cmd")
  if head -1 "$cmd" | tr -d '\r' | grep -q "^---$"; then
    log_pass "frontmatter in commands/$basename"
  else
    log_fail "no frontmatter in commands/$basename" "missing ---"
  fi
done

# SKILL.md exists
echo ""
echo "--- Skill files ---"
if [ -f "$PLUGIN_DIR/skills/wiki-manager/SKILL.md" ]; then
  log_pass "SKILL.md exists"
  if head -1 "$PLUGIN_DIR/skills/wiki-manager/SKILL.md" | tr -d '\r' | grep -q "^---$"; then
    log_pass "SKILL.md has frontmatter"
  else
    log_fail "SKILL.md has no frontmatter" "missing ---"
  fi
else
  log_fail "SKILL.md not found" "missing file"
fi

# Reference files exist
echo ""
echo "--- Reference files ---"
for ref in $REFERENCE_NAMES; do
  reffile="$PLUGIN_DIR/skills/wiki-manager/references/${ref}.md"
  if [ -f "$reffile" ]; then
    log_pass "references/$ref.md exists"
  else
    log_fail "references/$ref.md missing" "missing file"
  fi
done

# AGENTS.md exists at project root
echo ""
echo "--- Project files ---"
if [ -f "$PROJECT_ROOT/AGENTS.md" ]; then
  log_pass "AGENTS.md exists"
else
  log_fail "AGENTS.md missing" "missing file"
fi

echo ""
echo "--- ahnbu fork policy checks ---"
assert_contains "$PLUGIN_DIR/commands/compile.md" "Korean by default|한국어" "compile command documents Korean article defaults"
assert_contains "$PLUGIN_DIR/commands/query.md" "Korean by default|한국어" "query command documents Korean response defaults"
assert_contains "$PLUGIN_DIR/commands/output.md" "Korean by default|한국어" "output command documents Korean artifact defaults"
assert_contains "$PLUGIN_DIR/commands/ingest.md" "YYYYMMDD_NN_한국어-요약명\\.md|YYYYMMDD_NN" "ingest command documents YYYYMMDD_NN raw filename defaults"
assert_contains "$PLUGIN_DIR/skills/wiki-manager/references/ingestion.md" "YYYYMMDD_NN_한국어-요약명\\.md|YYYYMMDD_NN" "ingestion protocol documents YYYYMMDD_NN filename defaults"
assert_contains "$PLUGIN_DIR/skills/wiki-manager/references/wiki-structure.md" "YYYYMMDD_NN_한국어-요약명\\.md|YYYYMMDD_NN" "wiki structure documents YYYYMMDD_NN filename policy"
assert_not_contains "$PLUGIN_DIR/commands/ingest.md" "Generate filename: .*YYYY-MM-DD-한국어-요약명\\.md" "ingest command no longer uses dashed date raw filenames"
assert_not_contains "$PLUGIN_DIR/skills/wiki-manager/references/ingestion.md" "Prepend today's date: \`YYYY-MM-DD-\`" "ingestion protocol no longer uses dashed date slug generation"
assert_not_contains "$PLUGIN_DIR/skills/wiki-manager/references/wiki-structure.md" "Raw sources.*YYYY-MM-DD-한국어-요약명\\.md" "wiki structure no longer uses dashed date raw filename policy"
assert_contains "$PLUGIN_DIR/commands/ingest.md" "--split-heading <level>" "ingest command exposes heading split option"
assert_contains "$PLUGIN_DIR/commands/ingest.md" "split-markdown-source\\.mjs" "ingest command uses deterministic markdown split script"
assert_contains "$PLUGIN_DIR/skills/wiki-manager/references/ingestion.md" "split-markdown-source\\.mjs" "ingestion protocol documents deterministic markdown split script"
assert_contains "$PLUGIN_DIR/commands/ingest.md" "raw/notes/|type: notes" "ingest command routes book chapters to notes"
assert_contains "$PLUGIN_DIR/skills/wiki-manager/references/ingestion.md" "Book and Long Markdown Split|book chapter|책" "ingestion protocol documents book/chapter split"
assert_contains "$PLUGIN_DIR/skills/wiki-manager/references/ingestion.md" "split_heading_level|split_part_index|split_part_total" "ingestion protocol preserves split provenance"
assert_not_contains "$PLUGIN_DIR/commands/ingest.md" "\\[--type [^]]*book" "ingest argument hint does not expose book raw type"
assert_not_contains "$PLUGIN_DIR/skills/wiki-manager/references/wiki-structure.md" "type: articles\\|papers\\|repos\\|notes\\|data\\|book" "wiki structure raw type enum does not include book"
assert_contains "$PLUGIN_DIR/commands/wiki.md" "keep .*\\.wiki.*Git|Git.*\\.wiki|Do not append .*\\.wiki" "wiki init documents .wiki Git inclusion"
assert_not_contains "$PLUGIN_DIR/commands/wiki.md" "For local wikis .*: append .*\\.wiki/.*\\.gitignore" "wiki init no longer tells local users to ignore .wiki"
assert_contains "$PROJECT_ROOT/AGENTS.md" "keep .*\\.wiki.*Git|Git.*\\.wiki|Do not append .*\\.wiki" "portable protocol documents .wiki Git inclusion"

# Codex mirror validation — the artifacts that Codex installs from this repo.
# Drift between Claude source and this mirror is covered by test-codex-sync.sh;
# what's checked here is whether the mirror itself is well-formed.
echo ""
echo "=== Codex Mirror Validation ==="
CODEX_PLUGIN="$PROJECT_ROOT/plugins/llm-wiki"
CODEX_SKILL="$CODEX_PLUGIN/skills/wiki"

# Codex copies references into the generated tree because the marketplace cache
# needs real files, not a symlink back into the repo checkout.
echo ""
echo "--- Codex references copy ---"
REFS_DIR="$CODEX_SKILL/references"
if [ -d "$REFS_DIR" ] && [ ! -L "$REFS_DIR" ]; then
  log_pass "Codex references directory exists"
  for ref in $REFERENCE_NAMES; do
    if [ -f "$REFS_DIR/${ref}.md" ]; then
      log_pass "Codex references/$ref.md exists"
    else
      log_fail "Codex references/$ref.md missing" "missing copied reference file"
    fi
  done
else
  log_fail "Codex references directory invalid" "expected copied files under plugins/llm-wiki/skills/wiki/references"
fi

# Codex plugin manifest
echo ""
echo "--- Codex plugin manifest ---"
CODEX_MANIFEST="$CODEX_PLUGIN/.codex-plugin/plugin.json"
if [ -f "$CODEX_MANIFEST" ]; then
  log_pass ".codex-plugin/plugin.json exists"
  if python3 -c "import json; m=json.load(open('$CODEX_MANIFEST')); assert m.get('name') and m.get('version'), 'missing name or version'" 2>/dev/null; then
    log_pass ".codex-plugin/plugin.json parses with name + version"
  else
    log_fail ".codex-plugin/plugin.json invalid" "parse error or missing required field"
  fi
else
  log_fail ".codex-plugin/plugin.json not found" "missing file"
fi

# Codex marketplace entry
MARKETPLACE="$PROJECT_ROOT/.agents/plugins/marketplace.json"
if [ -f "$MARKETPLACE" ]; then
  log_pass ".agents/plugins/marketplace.json exists"
  if python3 -c "import json; json.load(open('$MARKETPLACE'))" 2>/dev/null; then
    log_pass ".agents/plugins/marketplace.json is valid JSON"
  else
    log_fail ".agents/plugins/marketplace.json invalid JSON" "parse error"
  fi
else
  log_fail ".agents/plugins/marketplace.json not found" "missing file"
fi

# Codex SKILL.md
echo ""
echo "--- Codex skill files ---"
if [ -f "$CODEX_SKILL/SKILL.md" ]; then
  log_pass "Codex SKILL.md exists"
  if head -1 "$CODEX_SKILL/SKILL.md" | tr -d '\r' | grep -q "^---$"; then
    log_pass "Codex SKILL.md has frontmatter"
  else
    log_fail "Codex SKILL.md has no frontmatter" "missing ---"
  fi
  if grep -Eq '^name:[[:space:]]*wiki[[:space:]]*$' "$CODEX_SKILL/SKILL.md"; then
    log_pass "Codex SKILL.md uses the wiki skill name"
  else
    log_fail "Codex SKILL.md uses the wrong skill name" "expected 'name: wiki'"
  fi
else
  log_fail "Codex SKILL.md not found" "missing file"
fi

# Codex agents/openai.yaml — minimal grep check (no PyYAML dep) for the two
# top-level keys the sync script writes.
OPENAI_YAML="$CODEX_SKILL/agents/openai.yaml"
if [ -f "$OPENAI_YAML" ]; then
  log_pass "agents/openai.yaml exists"
  if grep -q "^interface:" "$OPENAI_YAML" && grep -q "^policy:" "$OPENAI_YAML"; then
    log_pass "agents/openai.yaml has interface + policy keys"
  else
    log_fail "agents/openai.yaml missing required keys" "expected interface: and policy:"
  fi
else
  log_fail "agents/openai.yaml not found" "missing file"
fi

# OpenCode mirror validation — the artifacts that OpenCode loads via the
# "instructions" key in opencode.json. Drift between Claude source and this
# mirror is covered by test-opencode-sync.sh; what's checked here is whether
# the mirror itself is well-formed.
echo ""
echo "=== OpenCode Mirror Validation ==="
OPENCODE_PLUGIN="$PROJECT_ROOT/plugins/llm-wiki-opencode"
OPENCODE_SKILL="$OPENCODE_PLUGIN/skills/wiki-manager"

# References symlink
echo ""
echo "--- OpenCode references symlink ---"
OC_REFS_LINK="$OPENCODE_SKILL/references"
if [ -L "$OC_REFS_LINK" ]; then
  log_pass "OpenCode references is a symlink"
  if [ -e "$OC_REFS_LINK" ]; then
    log_pass "OpenCode references symlink resolves"
    for ref in $REFERENCE_NAMES; do
      if [ -f "$OC_REFS_LINK/${ref}.md" ]; then
        log_pass "OpenCode references/$ref.md reachable via symlink"
      else
        log_fail "OpenCode references/$ref.md not reachable via symlink" "broken target"
      fi
    done
  else
    log_fail "OpenCode references symlink target does not exist" "$(readlink "$OC_REFS_LINK")"
  fi
elif [ -f "$OC_REFS_LINK" ] && [ "$(cat "$OC_REFS_LINK")" = "../../../../claude-plugin/skills/wiki-manager/references" ]; then
  # Windows checkouts can materialize symlinks as plain text link files.
  log_pass "OpenCode references is a Git symlink placeholder file"
  OC_REFS_TARGET="$PROJECT_ROOT/claude-plugin/skills/wiki-manager/references"
  if [ -d "$OC_REFS_TARGET" ]; then
    log_pass "OpenCode references placeholder target resolves"
    for ref in $REFERENCE_NAMES; do
      if [ -f "$OC_REFS_TARGET/${ref}.md" ]; then
        log_pass "OpenCode references/$ref.md reachable via placeholder target"
      else
        log_fail "OpenCode references/$ref.md not reachable via placeholder target" "broken target"
      fi
    done
  else
    log_fail "OpenCode references placeholder target does not exist" "$OC_REFS_TARGET"
  fi
else
  log_fail "OpenCode references is not a symlink" "expected symlink to claude-plugin source"
fi

# OpenCode SKILL.md
echo ""
echo "--- OpenCode skill files ---"
if [ -f "$OPENCODE_SKILL/SKILL.md" ]; then
  log_pass "OpenCode SKILL.md exists"
  if head -1 "$OPENCODE_SKILL/SKILL.md" | tr -d '\r' | grep -q "^---$"; then
    log_pass "OpenCode SKILL.md has frontmatter"
  else
    log_fail "OpenCode SKILL.md has no frontmatter" "missing ---"
  fi
  # Verify no Claude Code references leaked through
  if ! grep -q "Claude Code" "$OPENCODE_SKILL/SKILL.md"; then
    log_pass "OpenCode SKILL.md has no 'Claude Code' references"
  else
    log_fail "OpenCode SKILL.md contains 'Claude Code'" "sync script missed a replacement"
  fi
else
  log_fail "OpenCode SKILL.md not found" "missing file"
fi

# OpenCode README
if [ -f "$OPENCODE_PLUGIN/README.md" ]; then
  log_pass "OpenCode README.md exists"
else
  log_fail "OpenCode README.md not found" "missing file"
fi

echo ""
echo "==========================================="
printf "Results: \033[32m%d passed\033[0m, \033[31m%d failed\033[0m, %d total\n" "$PASS" "$FAIL" "$TOTAL"
echo "==========================================="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
